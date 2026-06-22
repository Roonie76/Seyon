import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { ReadingProgress } from '@/components/blog/ReadingProgress/ReadingProgress';
import { ProductCTA } from '@/components/blog/ProductCTA/ProductCTA';
import { BlogCard } from '@/components/blog/BlogCard/BlogCard';
import { Calendar, Clock, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { BlogPost } from '@/types/blog';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = await db.blogPost.findMany({
    where: { published: true },
    select: { slug: true },
  });
  return posts.map((post) => ({ slug: post.slug }));
}

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
      publishedTime: post.date.toISOString(),
      authors: [post.author],
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

  const post = postRaw as unknown as BlogPost;

  // Fetch two recent other posts for the continue reading section
  const relatedPostsRaw = await db.blogPost.findMany({
    where: {
      published: true,
      id: { not: post.id },
    },
    orderBy: { date: 'desc' },
    take: 2,
  });

  const relatedPosts = relatedPostsRaw as unknown as BlogPost[];

  // Custom Editorial Markdown Compiler for Server Components
  const renderContent = (markdown: string) => {
    const blocks = markdown.split('\n\n').filter(Boolean);

    return blocks.map((block, idx) => {
      const trimmed = block.trim();

      // 1. Shop The Story CTA Integration
      const productMatch = trimmed.match(/^\[shop-the-story:(.+)\]$/);
      if (productMatch) {
        const productSlug = productMatch[1];
        return <ProductCTA key={idx} slug={productSlug} />;
      }

      // 2. Blockquotes
      if (trimmed.startsWith('>')) {
        const quoteText = trimmed.replace(/^>\s*/, '');
        return (
          <blockquote
            key={idx}
            className="my-10 pl-6 border-l-2 border-[#D4AF37] font-serif italic text-lg sm:text-xl text-[#E4C29D] leading-relaxed"
          >
            {quoteText}
          </blockquote>
        );
      }

      // 3. Section Headers
      if (trimmed.startsWith('## ')) {
        return (
          <h2
            key={idx}
            className="text-2xl sm:text-3xl font-light text-white font-serif tracking-tight mt-12 mb-4 uppercase"
          >
            {trimmed.replace(/^##\s*/, '')}
          </h2>
        );
      }
      if (trimmed.startsWith('### ')) {
        return (
          <h3
            key={idx}
            className="text-xl sm:text-2xl font-light text-white font-serif tracking-tight mt-10 mb-3 uppercase"
          >
            {trimmed.replace(/^###\s*/, '')}
          </h3>
        );
      }

      // 4. Standard Paragraph
      return (
        <p
          key={idx}
          className="text-base sm:text-lg text-[#b5b5b5] leading-[1.85] font-light mb-6"
        >
          {trimmed}
        </p>
      );
    });
  };

  return (
    <div className="relative w-full overflow-hidden bg-[#050505] text-zinc-300 min-h-screen">
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
          <Link
            href="/blog"
            className="group inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.3em] text-[#9D9D9D] hover:text-white transition-colors duration-300 mb-8 border border-zinc-900 bg-zinc-950/40 px-5 py-2 rounded-sm"
          >
            <ArrowLeft className="h-3 w-3 transition-transform duration-200 group-hover:-translate-x-0.5" />
            Back to Blog
          </Link>

          <div className="space-y-4">
            <span className="inline-block bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[#D4AF37] text-[10px] font-black uppercase tracking-[0.25em] px-4 py-1.5 rounded-sm">
              {post.category}
            </span>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-white font-serif tracking-tight leading-[1.1] uppercase max-w-3xl">
              {post.title}
            </h1>

            {/* Meta Row */}
            <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#9D9D9D] pt-4">
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
            {renderContent(post.content)}
          </div>
        </article>

        {/* Continue Reading Section */}
        {relatedPosts.length > 0 && (
          <section className="max-w-5xl mx-auto px-6 pb-28 space-y-10">
            <div className="text-center">
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#D4AF37]">
                Continue Reading
              </span>
              <h3 className="text-2xl sm:text-4xl font-light text-white font-serif uppercase tracking-tight mt-2">
                More Editorial Stories
              </h3>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
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
