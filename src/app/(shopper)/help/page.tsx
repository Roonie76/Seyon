import * as React from 'react';
import Link from 'next/link';
import { HelpCircle, User, Compass, ArrowRight, MessageSquare, Clock, ChevronRight, Headphones } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { BackButton } from '@/components/shared/back-button';
import { helpArticles } from '@/shared/data/help';
import { HelpSearch } from '@/components/help/HelpSearch';
import { generateFAQJSONLD, safeJsonLdStringify } from '@/lib/seo';

export const metadata = {
  title: 'Help Center',
  description:
    'How Seyon works: discovery rules, what buyers and sellers are each responsible for, and how ordering over WhatsApp actually happens.',
  alternates: { canonical: '/help' },
};

/**
 * Every help article, as a FAQPage.
 *
 * These 32 articles are the most quotable thing on the site -- each one is a
 * question with a written answer, which is the exact shape a search engine
 * pulls into a rich result and an assistant pulls into a citation. They were
 * carrying no structured data at all, so none of that could happen.
 *
 * The whole set rather than the popular few: the long tail is where the
 * specific questions live ("does Seyon take commission", "who handles a
 * refund"), and those are the ones somebody actually asks an assistant.
 *
 * Answers are trimmed because FAQPage wants a self-contained answer, not an
 * essay, and the full article is one link away.
 */
function faqEntries() {
  return helpArticles.map((article) => ({
    question: article.title,
    answer: article.content
      .replace(/\*\*/g, '')
      .replace(/^#+\s*/gm, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 900),
  }));
}

export default function HelpCenterPage() {
  const popularArticles = helpArticles.filter((a) => a.isPopular);
  const recentlyUpdated = [...helpArticles]
    .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
    .slice(0, 4);

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#1A1A18] relative">
      {/* FAQPage covering all help articles. Rendered through
          safeJsonLdStringify, which escapes the sequences that would let
          article text break out of the script tag. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(generateFAQJSONLD(faqEntries())) }}
      />

      {/*
        Editorial Luxury Container.

        `overflow-x-clip` because the decorative glow below is a fixed 600px
        wide and centred, so on a 390px viewport it hangs 105px past each edge.
        The page did not scroll sideways only because `body` carries a global
        `overflow-x: hidden` — the overhang was real, just masked. `clip`
        rather than `hidden` so this does not become a scroll container and
        break `position: sticky` for anything inside it.
      */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 md:py-24 relative overflow-x-clip">
        {/* Background glow styling */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[radial-gradient(circle_at_center,rgba(245,211,115,0.06)_0%,transparent_70%)] rounded-full pointer-events-none z-0" />

        {/* Go Back button */}
        <div className="relative z-10 mb-12">
          <BackButton fallbackHref="/marketplace" label="Go Back" className="text-[#6F6A63] hover:text-[#B88A2E]" />
        </div>

        {/* Hero Title Block */}
        <div className="text-center mb-16 space-y-4 relative z-10">
          <span className="text-[11px] md:text-xs uppercase font-bold text-[#B88A2E] tracking-widest block font-sans">
            HELP CENTER
          </span>
          <h1 className="text-4xl md:text-6xl font-normal text-[#1A1A18] tracking-tight font-serif">
            How can we help?
          </h1>
          <p className="text-sm md:text-base text-[#6F6A63] max-w-2xl mx-auto leading-relaxed font-sans">
            Everything you need to know about buying, selling and using Seyon.
          </p>
        </div>

        {/* Help Search Component */}
        <div className="mb-20 relative z-10">
          <HelpSearch articles={helpArticles} />
        </div>

        {/* Three Category Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-24 relative z-10">
          {/* Common Help */}
          <Card className="bg-[#FFFEFC] border border-[#ECE5D9] hover:border-[#D9BC82] shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_24px_rgba(0,0,0,0.04)] hover:-translate-y-1 rounded-[20px] overflow-hidden group transition-all duration-300">
            <CardContent className="p-6 flex flex-col h-full gap-6">
              <div className="space-y-4">
                <div className="h-10 w-10 rounded-full border border-[#ECE5D9] bg-[#FAF8F4] flex items-center justify-center text-[#B88A2E] shrink-0">
                  <HelpCircle className="h-5 w-5 stroke-[1.5]" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-[#1A1A18] font-serif">Common Help</h3>
                  <p className="text-xs text-[#6F6A63] leading-relaxed line-clamp-2 font-sans">
                    General guides about how Seyon works, payment boundaries, and Trust & Safety.
                  </p>
                </div>
              </div>
              <div className="border-t border-[#ECE5D9] pt-4 w-full mt-auto">
                <Link
                  href="/help/common"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#B88A2E] hover:text-[#C69A42] transition-colors uppercase tracking-wider group/link"
                >
                  Browse Common <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover/link:translate-x-1" />
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Buyer Help */}
          <Card className="bg-[#FFFEFC] border border-[#ECE5D9] hover:border-[#D9BC82] shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_24px_rgba(0,0,0,0.04)] hover:-translate-y-1 rounded-[20px] overflow-hidden group transition-all duration-300">
            <CardContent className="p-6 flex flex-col h-full gap-6">
              <div className="space-y-4">
                <div className="h-10 w-10 rounded-full border border-[#ECE5D9] bg-[#FAF8F4] flex items-center justify-center text-[#B88A2E] shrink-0">
                  <Compass className="h-5 w-5 stroke-[1.5]" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-[#1A1A18] font-serif">Buyer Help</h3>
                  <p className="text-xs text-[#6F6A63] leading-relaxed line-clamp-2 font-sans">
                    Guides for discovering unique items, saving to wishlist, and contacting creators.
                  </p>
                </div>
              </div>
              <div className="border-t border-[#ECE5D9] pt-4 w-full mt-auto">
                <Link
                  href="/help/buyer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#B88A2E] hover:text-[#C69A42] transition-colors uppercase tracking-wider group/link"
                >
                  Browse Buyers <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover/link:translate-x-1" />
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Seller Help */}
          <Card className="bg-[#FFFEFC] border border-[#ECE5D9] hover:border-[#D9BC82] shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_24px_rgba(0,0,0,0.04)] hover:-translate-y-1 rounded-[20px] overflow-hidden group transition-all duration-300">
            <CardContent className="p-6 flex flex-col h-full gap-6">
              <div className="space-y-4">
                <div className="h-10 w-10 rounded-full border border-[#ECE5D9] bg-[#FAF8F4] flex items-center justify-center text-[#B88A2E] shrink-0">
                  <User className="h-5 w-5 stroke-[1.5]" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-[#1A1A18] font-serif">Seller Help</h3>
                  <p className="text-xs text-[#6F6A63] leading-relaxed line-clamp-2 font-sans">
                    Guides for deploying catalog listings, custom storefront settings, and trust scores.
                  </p>
                </div>
              </div>
              <div className="border-t border-[#ECE5D9] pt-4 w-full mt-auto">
                <Link
                  href="/help/seller"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#B88A2E] hover:text-[#C69A42] transition-colors uppercase tracking-wider group/link"
                >
                  Browse Sellers <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover/link:translate-x-1" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Popular Articles & Recently Updated Split Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-24 relative z-10">
          {/* Popular Articles */}
          <div className="space-y-5">
            <div>
              <span className="text-[11px] uppercase font-bold text-[#B88A2E] tracking-widest block mb-1 font-sans">
                HELP ARTICLES
              </span>
              <h2 className="text-xl font-bold text-[#1A1A18] font-serif border-b border-[#ECE5D9] pb-3">
                Popular Articles
              </h2>
            </div>
            <div className="space-y-2">
              {popularArticles.map((article) => {
                const badgeTheme = article.category === 'seller' 
                  ? 'bg-[#FAF8F4] border border-[#D9BC82] text-[#B88A2E]' 
                  : 'bg-[#FAF8F4] border border-[#ECE5D9] text-[#6F6A63]';

                return (
                  <Link
                    key={article.slug}
                    href={`/help/${article.category}/${article.slug}`}
                    className="flex items-center justify-between py-3.5 px-4 rounded-xl border border-transparent hover:border-[#ECE5D9] hover:bg-[#FFFEFC] group transition-all duration-200 select-none text-left"
                  >
                    <span className="text-sm font-semibold text-[#1A1A18] group-hover:text-[#B88A2E] transition-colors font-sans mr-4">
                      {article.title}
                    </span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-[11px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full ${badgeTheme}`}>
                        {article.category}
                      </span>
                      <ChevronRight className="h-4 w-4 text-[#6F6A63] opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Recently Updated */}
          <div className="space-y-5">
            <div>
              <span className="text-[11px] uppercase font-bold text-[#B88A2E] tracking-widest block mb-1 font-sans">
                HELP ARTICLES
              </span>
              <h2 className="text-xl font-bold text-[#1A1A18] font-serif border-b border-[#ECE5D9] pb-3 flex items-center gap-2">
                <Clock className="h-5 w-5 text-[#B88A2E] stroke-[1.5]" />
                Recently Updated
              </h2>
            </div>
            <div className="space-y-2">
              {recentlyUpdated.map((article) => (
                <Link
                  key={article.slug}
                  href={`/help/${article.category}/${article.slug}`}
                  className="flex items-center justify-between py-3.5 px-4 rounded-xl border border-transparent hover:border-[#ECE5D9] hover:bg-[#FFFEFC] group transition-all duration-200 select-none text-left"
                >
                  <div className="min-w-0 pr-4">
                    <h4 className="text-sm font-semibold text-[#1A1A18] group-hover:text-[#B88A2E] transition-colors truncate font-sans">
                      {article.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="bg-[#FAF8F4] border border-[#ECE5D9] text-[#6F6A63] text-[11px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-full">
                        UPDATED
                      </span>
                      <p className="text-[11px] text-[#6F6A63] font-medium font-sans">Updated {article.lastUpdated}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#6F6A63] opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200 shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Concierge Support Card */}
        <div className="bg-[#FFFEFC] border border-[#ECE5D9] rounded-[24px] p-8 md:p-10 shadow-[0_1px_3px_rgba(0,0,0,0.02)] relative z-10">
          <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-8">
            <div className="space-y-4 text-center md:text-left flex-1">
              <div className="h-12 w-12 rounded-full border border-[#ECE5D9] bg-[#FAF8F4] flex items-center justify-center text-[#B88A2E] mx-auto md:mx-0">
                <Headphones className="h-6 w-6 stroke-[1.5]" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl md:text-2xl font-normal text-[#1A1A18] font-serif">
                  Still need help?
                </h3>
                <p className="text-xs md:text-sm text-[#6F6A63] max-w-xl leading-relaxed font-sans">
                  Our team usually replies within 24 hours. Contact support directly for questions regarding catalog reports or verification requirements.
                </p>
              </div>
            </div>
            <div className="flex flex-col items-center md:items-end shrink-0">
              <Link
                href="/contact"
                className="bg-[#1A1A18] hover:bg-[#2C2C29] text-[#FFFEFC] rounded-xl px-6 py-3.5 text-xs font-bold uppercase tracking-wider transition-all duration-200 hover:shadow-md hover:scale-102 flex items-center gap-2 cursor-pointer font-sans"
              >
                Contact Support &rarr;
              </Link>
              <span className="text-[11px] text-[#6F6A63] mt-2 block font-medium font-sans">
                Average response &lt; 24 Hours
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
