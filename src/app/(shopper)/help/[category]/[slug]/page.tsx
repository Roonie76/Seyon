import { SITE_URL } from '@/shared/lib/site';
import * as React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Calendar } from 'lucide-react';
import { helpArticles, type HelpCategory } from '@/shared/data/help';
import { TopicSidebar } from '@/components/help/TopicSidebar';
import { FeedbackCard } from '@/components/help/FeedbackCard';
import { ResponsibilityMatrix } from '@/components/help/ResponsibilityMatrix';
import { BackButton } from '@/components/shared/back-button';
import { safeJsonLdStringify } from '@/lib/seo';

interface ArticlePageProps {
  params: Promise<{
    category: string;
    slug: string;
  }>;
}

export async function generateMetadata({ params }: ArticlePageProps) {
  const resolvedParams = await params;
  const category = resolvedParams.category as HelpCategory;
  const slug = resolvedParams.slug;

  const article = helpArticles.find((a) => a.category === category && a.slug === slug);
  if (!article) {
    return { title: 'Article Not Found' };
  }

  return {
    title: `${article.title} — Help Center`,
    description: article.content.substring(0, 155) + '...',
  };
}

export default async function HelpArticlePage({ params }: ArticlePageProps) {
  const resolvedParams = await params;
  const category = resolvedParams.category as HelpCategory;
  const slug = resolvedParams.slug;

  const article = helpArticles.find((a) => a.category === category && a.slug === slug);
  if (!article) {
    notFound();
  }

  // Related articles: same category, different slug, up to 3 items
  const relatedArticles = helpArticles
    .filter((a) => a.category === category && a.slug !== slug)
    .slice(0, 3);

  const categoryLabels: Record<HelpCategory, string> = {
    common: 'Common Help',
    buyer: 'Buyer Help',
    seller: 'Seller Help',
  };

  // Generate Article JSON-LD Schema
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    'headline': article.title,
    'description': article.content.substring(0, 160) + '...',
    'dateModified': article.lastUpdated,
    'publisher': {
      '@type': 'Organization',
      'name': 'Seyon',
      'logo': {
        '@type': 'ImageObject',
        // Structured data must be an absolute URL, and seyon.in is not the
        // domain this is deployed on. Derive it instead of naming a host that
        // may belong to somebody else.
        'url': `${SITE_URL}/icon`
      }
    }
  };

  // Helper to format Markdown content simply for React
  const renderFormattedContent = (content: string) => {
    return content.split('\n\n').map((paragraph, index) => {
      const trimmed = paragraph.trim();
      
      // Render heading: ### Title
      if (trimmed.startsWith('### ')) {
        return (
          <h3 key={index} className="text-base font-bold text-[#1A1A18] font-serif mt-6 mb-2">
            {trimmed.replace('### ', '')}
          </h3>
        );
      }
      
      // Render list items: * Item
      if (trimmed.startsWith('* ')) {
        const items = trimmed
          .split('\n')
          .map((li) => li.replace(/^\*\s*/, '').trim());
        return (
          <ul key={index} className="list-disc pl-5 my-4 space-y-2 text-[#6F6A63]">
            {items.map((item, subIndex) => (
              <li key={subIndex} className="text-sm leading-relaxed font-sans">{item}</li>
            ))}
          </ul>
        );
      }

      // Render numbered list items: 1. Item
      if (trimmed.match(/^\d+\.\s/)) {
        const items = trimmed
          .split('\n')
          .map((li) => li.replace(/^\d+\.\s*/, '').trim());
        return (
          <ol key={index} className="list-decimal pl-5 my-4 space-y-2 text-[#6F6A63]">
            {items.map((item, subIndex) => (
              <li key={subIndex} className="text-sm leading-relaxed font-sans">{item}</li>
            ))}
          </ol>
        );
      }

      // Standard paragraph
      return (
        <p key={index} className="text-sm text-[#6F6A63] leading-relaxed my-3 font-sans">
          {trimmed}
        </p>
      );
    });
  };

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#1A1A18]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        {/* Schema Injection */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(articleSchema) }}
        />

        {/* Breadcrumbs */}
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#6F6A63]/60 mb-6 font-sans">
          <Link href="/help" className="hover:text-[#B88A2E] transition-colors">
            Help Center
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link href={`/help/${category}`} className="hover:text-[#B88A2E] transition-colors">
            {categoryLabels[category]}
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-[#1A1A18] font-bold truncate max-w-[200px]">{article.title}</span>
        </div>

        <BackButton fallbackHref={`/help/${category}`} label="Go Back" className="mb-10 text-[#6F6A63] hover:text-[#B88A2E]" />

        {/* Main Layout Grid */}
        <div className="flex flex-col md:flex-row gap-12 items-start">
          {/* Category Sidebar */}
          <TopicSidebar category={category} articles={helpArticles} activeSlug={slug} />

          {/* Article Content Pane */}
          <div className="flex-1 w-full space-y-10">
            <article className="border-b border-[#ECE5D9] pb-10">
              <h1 className="text-3xl md:text-5xl font-normal text-[#1A1A18] tracking-tight font-serif leading-tight">
                {article.title}
              </h1>
              
              <div className="flex items-center gap-2 text-xs text-[#6F6A63] mt-4 font-sans font-medium">
                <Calendar className="h-3.5 w-3.5 stroke-[1.5]" />
                <span>Last updated on {article.lastUpdated}</span>
              </div>

              <div className="mt-8 prose prose-zinc max-w-none">
                {renderFormattedContent(article.content)}
              </div>

              {/* Embed the Responsibility Matrix if appropriate */}
              {(slug === 'what-is-seyon' || slug === 'does-seyon-process-payments' || slug === 'does-seyon-deliver-products') && (
                <div className="mt-8">
                  <ResponsibilityMatrix />
                </div>
              )}
            </article>

            {/* Feedback Widget */}
            <FeedbackCard />

            {/* Related Articles Section */}
            {relatedArticles.length > 0 && (
              <div className="space-y-6 pt-4">
                <h3 className="text-sm font-bold text-[#1A1A18] uppercase tracking-wider font-serif">
                  Related Articles
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {relatedArticles.map((art) => (
                    <Link
                      key={art.slug}
                      href={`/help/${category}/${art.slug}`}
                      className="p-5 rounded-[20px] border border-[#ECE5D9] hover:border-[#D9BC82] bg-[#FFFEFC] hover:shadow-[0_12px_24px_rgba(0,0,0,0.04)] transition-all duration-300 flex flex-col justify-between gap-4 group"
                    >
                      <span className="text-xs font-bold text-[#1A1A18] font-serif leading-snug group-hover:text-[#B88A2E] transition-colors line-clamp-2">
                        {art.title}
                      </span>
                      <span className="text-[10px] text-[#B88A2E] font-bold uppercase tracking-wider font-sans group-hover:translate-x-1 duration-200 transition-all">
                        Read Guide &rarr;
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
