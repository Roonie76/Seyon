import * as React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { HelpArticle, HelpCategory } from '@/shared/data/help';

interface TopicSidebarProps {
  category: HelpCategory;
  articles: HelpArticle[];
  activeSlug?: string;
}

export function TopicSidebar({ category, articles, activeSlug }: TopicSidebarProps) {
  // Filter articles in current category
  const categoryArticles = articles.filter((a) => a.category === category);

  // Group by topic
  const grouped: Record<string, HelpArticle[]> = {};
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
    <aside className="w-full md:w-64 shrink-0 space-y-6 font-sans">
      {/* Category header */}
      <div className="border-b border-[#ECE5D9] pb-4">
        <span className="text-[9px] uppercase font-bold tracking-widest text-[#6F6A63]/60">Section</span>
        <h2 className="text-xl font-normal text-[#1A1A18] font-serif mt-1">{categoryLabels[category]}</h2>
      </div>

      <nav className="space-y-6">
        {Object.entries(grouped).map(([topic, arts]) => (
          <div key={topic} className="space-y-2">
            <h3 className="text-[9px] uppercase font-bold tracking-widest text-[#B88A2E]">
              {topic}
            </h3>
            <ul className="space-y-1">
              {arts.map((art) => {
                const isActive = art.slug === activeSlug;
                return (
                  <li key={art.slug}>
                    <Link
                      href={`/help/${category}/${art.slug}`}
                      className={`group flex items-center justify-between text-xs py-2 px-3 rounded-lg font-semibold transition-all ${
                        isActive
                          ? 'bg-[#FFFEFC] text-[#B88A2E] border-l-2 border-[#B88A2E] pl-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.01)]'
                          : 'text-[#6F6A63] hover:text-[#B88A2E] hover:bg-[#FFFEFC]'
                      }`}
                    >
                      <span className="truncate flex-1">{art.title}</span>
                      <ChevronRight className={`h-3 w-3 text-[#6F6A63] group-hover:translate-x-0.5 transition-transform ${
                        isActive ? 'text-[#B88A2E]' : 'opacity-0 group-hover:opacity-100'
                      }`} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
