import * as React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, FileText, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { helpArticles, type HelpCategory } from '@/shared/data/help';
import { TopicSidebar } from '@/components/help/TopicSidebar';
import { BackButton } from '@/components/shared/back-button';

interface CategoryPageProps {
  params: Promise<{
    category: string;
  }>;
}

export async function generateMetadata({ params }: CategoryPageProps) {
  const resolvedParams = await params;
  const category = resolvedParams.category as HelpCategory;

  const validCategories: HelpCategory[] = ['common', 'buyer', 'seller'];
  if (!validCategories.includes(category)) {
    return { title: 'Not Found' };
  }

  const categoryLabels: Record<HelpCategory, string> = {
    common: 'Common Help',
    buyer: 'Buyer Help',
    seller: 'Seller Help',
  };

  return {
    title: `${categoryLabels[category]} | Seyon Help Center`,
    description: `Read articles and guides for ${categoryLabels[category]} on Seyon.`,
  };
}

export default async function HelpCategoryPage({ params }: CategoryPageProps) {
  const resolvedParams = await params;
  const category = resolvedParams.category as HelpCategory;

  const validCategories: HelpCategory[] = ['common', 'buyer', 'seller'];
  if (!validCategories.includes(category)) {
    notFound();
  }

  const categoryArticles = helpArticles.filter((a) => a.category === category);

  // Group by topic for the listing
  const grouped: Record<string, typeof helpArticles> = {};
  categoryArticles.forEach((art) => {
    if (!grouped[art.topic]) {
      grouped[art.topic] = [];
    }
    grouped[art.topic].push(art);
  });

  const categoryLabels: Record<HelpCategory, string> = {
    common: 'Common Help',
    buyer: 'Buyer Help',
    seller: 'Seller Help',
  };

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#1A1A18]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#6F6A63]/60 mb-6 font-sans">
          <Link href="/help" className="hover:text-[#B88A2E] transition-colors">
            Help Center
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-[#1A1A18] font-bold">{categoryLabels[category]}</span>
        </div>

        <BackButton fallbackHref="/help" label="Go Back" className="mb-10 text-[#6F6A63] hover:text-[#B88A2E]" />

        {/* Main Layout Grid */}
        <div className="flex flex-col md:flex-row gap-12 items-start">
          {/* Category Sidebar */}
          <TopicSidebar category={category} articles={helpArticles} />

          {/* Category Content List */}
          <div className="flex-1 space-y-12 w-full">
            <div className="border-b border-[#ECE5D9] pb-6">
              <h1 className="text-3xl md:text-5xl font-normal text-[#1A1A18] tracking-tight font-serif">
                {categoryLabels[category]} Guides
              </h1>
              <p className="text-xs md:text-sm text-[#6F6A63] mt-2 leading-relaxed font-sans">
                Explore resources, rules, and guidelines regarding {categoryLabels[category].toLowerCase()} on the Seyon marketplace.
              </p>
            </div>

            <div className="space-y-12">
              {Object.entries(grouped).map(([topic, arts]) => (
                <section key={topic} className="space-y-6">
                  <h3 className="text-[10px] font-bold text-[#B88A2E] uppercase tracking-widest border-l-2 border-[#B88A2E] pl-3 font-sans">
                    {topic}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {arts.map((art) => (
                      <Card
                        key={art.slug}
                        className="bg-[#FFFEFC] border border-[#ECE5D9] hover:border-[#D9BC82] shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_24px_rgba(0,0,0,0.04)] rounded-[20px] overflow-hidden group transition-all duration-300"
                      >
                        <CardContent className="p-6 flex flex-col justify-between h-full gap-4">
                          <div className="space-y-3">
                            <div className="h-10 w-10 rounded-full border border-[#ECE5D9] bg-[#FAF8F4] flex items-center justify-center text-[#B88A2E] shrink-0">
                              <FileText className="h-5 w-5 stroke-[1.5]" />
                            </div>
                            <h4 className="text-sm font-bold text-[#1A1A18] font-serif leading-snug group-hover:text-[#B88A2E] transition-colors">
                              {art.title}
                            </h4>
                            <p className="text-[11px] text-[#6F6A63] leading-relaxed line-clamp-2 font-sans">
                              {art.content.replace(/[#*`]/g, '')}
                            </p>
                          </div>
                          <div className="border-t border-[#ECE5D9] pt-4 w-full mt-auto">
                            <Link
                              href={`/help/${category}/${art.slug}`}
                              className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#B88A2E] hover:text-[#C69A42] tracking-wider uppercase group-hover/link:translate-x-1 duration-200 transition-all font-sans"
                            >
                              Read Article <ArrowRight className="h-3 w-3" />
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
