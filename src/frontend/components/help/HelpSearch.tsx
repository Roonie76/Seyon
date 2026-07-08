'use client';

import * as React from 'react';
import Link from 'next/link';
import { Search, X, HelpCircle, ChevronRight } from 'lucide-react';
import type { HelpArticle } from '@/shared/data/help';

export function HelpSearch({ articles }: { articles: HelpArticle[] }) {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<HelpArticle[]>([]);

  React.useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const lowercaseQuery = query.toLowerCase().trim();
    const filtered = articles.filter(
      (article) =>
        article.title.toLowerCase().includes(lowercaseQuery) ||
        article.content.toLowerCase().includes(lowercaseQuery) ||
        article.topic.toLowerCase().includes(lowercaseQuery)
    );
    setResults(filtered.slice(0, 5)); // Limit to top 5 matches
  }, [query, articles]);

  return (
    <div className="relative w-full max-w-2xl mx-auto z-30 font-sans">
      <div className="relative flex items-center w-full h-[56px] md:h-[60px] bg-[#FFFEFC] border border-[#ECE5D9] focus-within:border-[#B88A2E] focus-within:ring-4 focus-within:ring-[#B88A2E]/5 rounded-2xl px-5 transition-all shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
        <Search className="h-5 w-5 text-[#6F6A63] mr-3 shrink-0 stroke-[1.5]" />
        <input
          type="text"
          placeholder="Search articles, questions or topics..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-transparent border-0 outline-0 focus:ring-0 text-sm md:text-base text-[#1A1A18] placeholder-[#6F6A63]/50"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="text-[#6F6A63] hover:text-[#1A1A18] transition-colors p-1"
            type="button"
          >
            <X className="h-5 w-5 stroke-[1.5]" />
          </button>
        )}
      </div>

      {/* Instant Search Results Dropdown */}
      {query && (
        <div className="absolute top-full left-0 right-0 mt-3 border border-[#ECE5D9] rounded-2xl bg-[#FFFEFC] shadow-[0_12px_24px_rgba(0,0,0,0.05)] divide-y divide-[#ECE5D9] p-2 animate-fade-in z-50 overflow-hidden">
          {results.length > 0 ? (
            <>
              <div className="px-3 py-2 text-[9px] uppercase font-bold text-[#B88A2E] tracking-widest">
                Matching Articles
              </div>
              <div className="space-y-0.5">
                {results.map((article) => (
                  <Link
                    key={article.slug}
                    href={`/help/${article.category}/${article.slug}`}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#FAF8F4] group transition-colors text-left"
                  >
                    <div className="h-8 w-8 rounded-full border border-[#ECE5D9] bg-[#FAF8F4] flex items-center justify-center text-[#B88A2E] shrink-0 transition-colors">
                      <HelpCircle className="h-4.5 w-4.5 stroke-[1.5]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-[#1A1A18] truncate group-hover:text-[#B88A2E] transition-colors">
                        {article.title}
                      </h4>
                      <p className="text-[10px] text-[#6F6A63] font-medium truncate mt-0.5">
                        {article.topic} &middot; {article.category.toUpperCase()} HELP
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-[#6F6A63] opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200" />
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-[#6F6A63]">
              <p className="text-sm font-medium">No results found for &ldquo;{query}&rdquo;</p>
              <p className="text-xs text-[#6F6A63]/70 mt-1">Try checking your spelling or search another keyword</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
