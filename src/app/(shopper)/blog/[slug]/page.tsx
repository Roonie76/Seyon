import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { ReadingProgress } from '@/components/blog/ReadingProgress/ReadingProgress';
import { BlogCard } from '@/components/blog/BlogCard/BlogCard';
import { RenderBlocks } from '@/components/blog/render-blocks';
import { parseBlocks, wordCount } from '@/shared/blog/parse';
import { topicsForPost } from '@/shared/blog/topics';
import {
  generateBlogPostingJSONLD,
  generateBreadcrumbJSONLD,
  safeJsonLdStringify,
} from '@/lib/seo';
import { Calendar, Clock } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { BlogPost } from '@/types/blog';

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Rendered per request, like every other page in this group.
 *
 * The shared Navbar calls `auth()`, which reads cookies, so nothing under
 * (shopper) can be prerendered -- which is why /blog already carries this
 * export. This page did not, and had `generateStaticParams` instead. With an
 * empty database at build time that produced a static route with no params,
 * and the first request for any article bailed:
 *
 *   digest: 'DYNAMIC_SERVER_USAGE'  ->  500
 *
 * Reproduced on production the moment the first post existed. The route was
 * never able to serve an article on that build; it simply had no article to
 * fail on. `generateStaticParams` is removed rather than left in place,
 * because `force-dynamic` ignores it and a reader of this file should not have
 * to work out which one wins.
 *
 * The deeper fix is to stop the Navbar forcing the whole group dynamic. That
 * is a change to every shopper page, not to the blog, and is noted rather than
 * attempted here.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await db.blogPost.findUnique({
    where: { slug },
  });
  if (!post) return { title: 'Story Not Found' };

  return {
    title: post.seoTitle || `${post.title} — Seyon`,
    description: post.seoDescription || post.excerpt,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      title: post.seoTitle || post.title,
      description: post.seoDescription || post.excerpt,
      type: 'article',
      url: `/blog/${slug}`,
      publishedTime: post.date.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      authors: [post.author],
      images: [{ url: post.cover }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.seoTitle || post.title,
      description: post.seoDescription || post.excerpt,
      images: [post.cover],
    },
  };
}

export default async function BlogArticlePage({ params }: PageProps) {
  const { slug } = await params;

  // Fetch current post
  const postRaw = await db.blogPost.findUnique({
    where: { slug },
  });

  if (!postRaw) {
    notFound();
  }

  /**
   * A draft is not merely unlisted.
   *
   * This page used to fetch by slug alone, so an unpublished post was absent
   * from /blog and served in full to anyone who had, or guessed, its URL.
   * "Save as draft" has to mean the reader cannot read it.
   *
   * The check is a plain column comparison rather than an admin session lookup
   * on purpose: reading cookies here would opt the whole route out of static
   * generation for every reader, to serve a preview one person needs. Previews
   * live in the editor instead, where the Preview tab renders the same blocks
   * through the same parser.
   */
  if (!postRaw.published) {
    notFound();
  }

  const post = postRaw as unknown as BlogPost;

  /**
   * "Continue reading" used to be the two most recent other posts, which is
   * the same two links on every article. For a blog whose job is to bring
   * people in, the links out of an article are most of the value: they are
   * what keeps a reader on the site and what tells a crawler which pages
   * belong together.
   *
   * Candidates are drawn from the same topic hubs as this post, then ranked by
   * how many tags they share with it, falling back to recency for ties and to
   * fill the slots when a topic is still thin.
   */
  const topics = topicsForPost(postRaw.tags);
  const siblingTags = Array.from(new Set(topics.flatMap((t) => t.tags)));

  const candidatesRaw = await db.blogPost.findMany({
    where: {
      published: true,
      id: { not: post.id },
      ...(siblingTags.length ? { tags: { hasSome: siblingTags } } : {}),
    },
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
    take: 12,
  });

  const ownTags = new Set(postRaw.tags.map((t) => t.toUpperCase()));
  const ranked = [...candidatesRaw].sort((a, b) => {
    const score = (tags: string[]) =>
      tags.filter((t) => ownTags.has(t.toUpperCase())).length;
    const diff = score(b.tags) - score(a.tags);
    if (diff !== 0) return diff;
    const byDate = b.date.getTime() - a.date.getTime();
    return byDate !== 0 ? byDate : (a.id < b.id ? 1 : -1);
  });

  let relatedRaw = ranked.slice(0, 3);

  // A post whose tags match no hub yet would otherwise show nothing at all.
  if (relatedRaw.length === 0) {
    relatedRaw = await db.blogPost.findMany({
      where: { published: true, id: { not: post.id } },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      take: 3,
    });
  }

  const relatedPosts = relatedRaw as unknown as BlogPost[];

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Blog', url: '/blog' },
    ...(topics[0] ? [{ name: topics[0].label, url: `/blog/topic/${topics[0].slug}` }] : []),
    { name: post.title, url: `/blog/${post.slug}` },
  ];

  const articleSchema = generateBlogPostingJSONLD({
    slug: postRaw.slug,
    title: postRaw.title,
    excerpt: postRaw.excerpt,
    cover: postRaw.cover,
    author: postRaw.author,
    date: postRaw.date,
    updatedAt: postRaw.updatedAt,
    keywords: postRaw.seoKeywords.length ? postRaw.seoKeywords : postRaw.tags,
    wordCount: wordCount(postRaw.content),
  });

  // Content is parsed by the shared blog parser, the same one the admin
  // preview renders, so the editor cannot show one thing and the page another.
  const blocks = parseBlocks(post.content);

  return (
    <div className="relative w-full overflow-hidden bg-[#050505] text-zinc-300 min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify(generateBreadcrumbJSONLD(breadcrumbItems)),
        }}
      />

      {/* Scroll Reading Progress Indicator */}
      <ReadingProgress />

      {/* Grid line backgrounds */}
      <style dangerouslySetInnerHTML={{ __html: `
        .luxury-bg-article {
          background-color: #050505;
          background-image: 
            radial-gradient(circle at top, rgba(212, 175, 55, 0.06), transparent 45%),
            linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px);
          background-size: 100% 100%, 120px 120px, 120px 120px;
        }
      `}} />
      <div className="luxury-bg-article absolute inset-0 pointer-events-none z-0" />

      {/* Back glow overlay */}
      <div className="pointer-events-none absolute top-[40%] right-[10%] w-[500px] h-[500px] bg-[#D4AF37]/3 rounded-full blur-[150px] z-0" />

      <div className="relative z-10">
        {/* Article Hero Section */}
        <header className="max-w-4xl mx-auto px-6 pt-28 sm:pt-36 pb-12 flex flex-col items-center text-center">
          {/* Visible breadcrumb, mirroring the BreadcrumbList emitted above. */}
          <nav aria-label="Breadcrumb" className="mb-8">
            <ol className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-[#9D9D9D]">
              <li>
                <Link href="/" className="hover:text-white transition-colors">Home</Link>
              </li>
              <li aria-hidden="true" className="text-zinc-800">/</li>
              <li>
                <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
              </li>
              {topics[0] && (
                <>
                  <li aria-hidden="true" className="text-zinc-800">/</li>
                  <li>
                    <Link
                      href={`/blog/topic/${topics[0].slug}`}
                      className="hover:text-white transition-colors"
                    >
                      {topics[0].label}
                    </Link>
                  </li>
                </>
              )}
            </ol>
          </nav>

          <div className="space-y-4">
            <span className="inline-block bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[#D4AF37] text-[11px] font-black uppercase tracking-[0.25em] px-4 py-1.5 rounded-sm">
              {post.category}
            </span>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-white font-serif tracking-tight leading-[1.1] uppercase max-w-3xl">
              {post.title}
            </h1>

            {/* Meta Row */}
            <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#9D9D9D] pt-4">
              <span>{post.author}</span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3 text-[#D4AF37]" />
                {new Date(post.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3 text-[#D4AF37]" />
                {post.readingTime} MIN READ
              </span>
            </div>
          </div>
        </header>

        {/* Cinematic Cover Image */}
        <section className="max-w-6xl mx-auto px-6 mb-16">
          <div className="aspect-[21/9] w-full rounded-3xl overflow-hidden border border-zinc-900 bg-[#0f0f0f] relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.cover}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        </section>

        {/* Long-Form Text Content */}
        <article className="max-w-2xl sm:max-w-3xl mx-auto px-6 py-8 border-b border-zinc-900/60 mb-16">
          <div className="prose prose-invert max-w-none">
            <RenderBlocks blocks={blocks} />
          </div>
        </article>

        {/* Topic hubs this article sits under. These are the links that give a
            crawler a route from a leaf article back up to a cluster page, and
            give a reader the obvious next thing to read. */}
        {topics.length > 0 && (
          <section className="max-w-3xl mx-auto px-6 pb-16">
            <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-[#D4AF37] mb-5">
              Read more on
            </h2>
            <div className="flex flex-wrap gap-3">
              {topics.map((t) => (
                <Link
                  key={t.slug}
                  href={`/blog/topic/${t.slug}`}
                  className="px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.15em] border border-zinc-900 bg-[#0f0f0f] text-zinc-400 rounded-sm transition-all duration-300 hover:bg-[#D4AF37] hover:text-black hover:border-[#D4AF37]"
                >
                  {t.label}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Continue Reading Section */}
        {relatedPosts.length > 0 && (
          <section className="max-w-5xl mx-auto px-6 pb-28 space-y-10">
            <div className="text-center">
              <span className="text-[11px] font-black uppercase tracking-[0.25em] text-[#D4AF37]">
                Continue Reading
              </span>
              <h3 className="text-2xl sm:text-4xl font-light text-white font-serif uppercase tracking-tight mt-2">
                Keep reading
              </h3>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {relatedPosts.map((related) => (
                <BlogCard key={related.id} post={related} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
