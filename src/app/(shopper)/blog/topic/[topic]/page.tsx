import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import { db } from '@/lib/db';
import { BlogCard } from '@/components/blog/BlogCard/BlogCard';
import { BlogPost } from '@/types/blog';
import { BLOG_TOPICS, topicBySlug } from '@/shared/blog/topics';

/** A hub lists cards, not an archive. Well beyond the 30 posts that exist. */
const TOPIC_HUB_LIMIT = 60;
import {
  generateBlogJSONLD,
  generateBreadcrumbJSONLD,
  safeJsonLdStringify,
} from '@/lib/seo';

interface PageProps {
  params: Promise<{ topic: string }>;
}

/**
 * Same reason as every other page in this group: the shared Navbar calls
 * `auth()`, so nothing under (shopper) can be prerendered.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { topic: slug } = await params;
  const topic = topicBySlug(slug);
  if (!topic) return { title: 'Topic Not Found' };

  return {
    title: topic.seoTitle,
    description: topic.description,
    alternates: { canonical: `/blog/topic/${topic.slug}` },
    openGraph: {
      title: topic.seoTitle,
      description: topic.description,
      type: 'website',
      url: `/blog/topic/${topic.slug}`,
    },
  };
}

export default async function BlogTopicPage({ params }: PageProps) {
  const { topic: slug } = await params;
  const topic = topicBySlug(slug);

  // An unknown segment is a 404, not an empty hub. Serving a page for every
  // string anyone types would put an unbounded number of near-identical URLs
  // in front of a crawler.
  if (!topic) {
    notFound();
  }

  /**
   * Bounded, and without the article bodies.
   *
   * This selected every column of every matching post, which meant the full
   * markdown of each article — the hub renders cards and never reads
   * `content`. With no `take` either, one badly-chosen tag would have loaded
   * the entire blog into memory to render a grid.
   */
  const postsRaw = await db.blogPost.findMany({
    where: {
      published: true,
      tags: { hasSome: topic.tags },
    },
    omit: { content: true },
    // `id` tie-breaks, as on /blog: ordering by date alone is not deterministic
    // when posts share a timestamp.
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
    take: TOPIC_HUB_LIMIT,
  });

  const posts = postsRaw as unknown as BlogPost[];

  const breadcrumb = generateBreadcrumbJSONLD([
    { name: 'Home', url: '/' },
    { name: 'Blog', url: '/blog' },
    { name: topic.label, url: `/blog/topic/${topic.slug}` },
  ]);

  const blogSchema = generateBlogJSONLD(
    topic.heading,
    topic.description,
    `/blog/topic/${topic.slug}`,
    postsRaw.map((p) => ({
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      date: p.date,
    }))
  );

  const siblings = BLOG_TOPICS.filter((t) => t.slug !== topic.slug);

  return (
    <div className="relative w-full overflow-hidden bg-[#050505] text-zinc-300 min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(breadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(blogSchema) }}
      />

      <style dangerouslySetInnerHTML={{ __html: `
        .luxury-bg-topic {
          background-color: #050505;
          background-image:
            radial-gradient(circle at top, rgba(212, 175, 55, 0.07), transparent 45%),
            linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px);
          background-size: 100% 100%, 120px 120px, 120px 120px;
        }
      `}} />
      <div className="luxury-bg-topic absolute inset-0 pointer-events-none z-0" />

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-28 sm:pt-36 pb-24">
        {/* Visible breadcrumb, mirroring the BreadcrumbList above it. */}
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-[#9D9D9D]">
            <li>
              <Link href="/" className="hover:text-white transition-colors">Home</Link>
            </li>
            <li aria-hidden="true" className="text-zinc-800">/</li>
            <li>
              <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
            </li>
            <li aria-hidden="true" className="text-zinc-800">/</li>
            <li className="text-[#D4AF37]" aria-current="page">{topic.label}</li>
          </ol>
        </nav>

        <header className="max-w-3xl space-y-6 border-b border-zinc-900 pb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-light text-white font-serif tracking-tight leading-[1.1] uppercase">
            {topic.heading}
          </h1>
          {topic.intro.map((para, i) => (
            <p key={i} className="text-base sm:text-lg text-[#b5b5b5] font-light leading-relaxed">
              {para}
            </p>
          ))}
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#D4AF37]">
            {posts.length} {posts.length === 1 ? 'Article' : 'Articles'}
          </p>
        </header>

        {posts.length === 0 ? (
          <div className="mt-16 text-center py-20 border border-zinc-900 bg-[#0f0f0f] rounded-3xl space-y-4">
            <p className="text-sm text-zinc-400 font-light">
              Nothing published under this topic yet.
            </p>
            <Link
              href="/blog"
              className="inline-block text-xs font-black uppercase tracking-[0.2em] text-[#D4AF37] hover:underline"
            >
              Back to all articles
            </Link>
          </div>
        ) : (
          <div className="mt-16 grid md:grid-cols-2 gap-8">
            {posts.map((post) => (
              <BlogCard key={post.id} post={post} />
            ))}
          </div>
        )}

        {/* Sibling hubs: the crawl path between clusters, and the reader's too. */}
        <section className="mt-24 space-y-8">
          <h2 className="text-lg font-light text-white font-serif uppercase tracking-wider border-b border-zinc-900 pb-4">
            Other topics
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {siblings.map((sib) => (
              <Link
                key={sib.slug}
                href={`/blog/topic/${sib.slug}`}
                className="group block rounded-3xl border border-zinc-900 bg-[#0f0f0f] p-6 transition-all duration-300 hover:border-zinc-800 hover:-translate-y-0.5"
              >
                <h3 className="text-base font-light text-white font-serif uppercase tracking-tight group-hover:text-[#E4C29D] transition-colors">
                  {sib.label}
                </h3>
                <p className="mt-3 text-sm text-[#9D9D9D] font-light leading-relaxed line-clamp-3">
                  {sib.description}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <div className="mt-16">
          <Link
            href="/blog"
            className="group inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.3em] text-[#9D9D9D] hover:text-white transition-colors duration-300 border border-zinc-900 bg-zinc-950/40 px-5 py-2 rounded-sm"
          >
            <ArrowLeft className="h-3 w-3 transition-transform duration-200 group-hover:-translate-x-0.5" />
            All articles
          </Link>
        </div>
      </div>
    </div>
  );
}
