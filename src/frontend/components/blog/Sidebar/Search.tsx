'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useTransition } from 'react';
import { Search as SearchIcon, Loader2 } from 'lucide-react';

export function Search() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get('q') || '');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const q = searchParams.get('q') || '';
    const frame = requestAnimationFrame(() => {
      setValue(q);
    });
    return () => cancelAnimationFrame(frame);
  }, [searchParams]);

  /**
   * Push only when the box actually disagrees with the URL.
   *
   * This effect used to fire on mount as well as on typing, and it ends with
   * `params.delete('page')`. So four hundred milliseconds after any load of
   * /blog?page=3, the search box navigated to /blog and took the page number
   * with it -- and because `searchParams` is a dependency, the new URL
   * retriggered it. Pagination was dead: every click went to page two and was
   * pushed straight back to page one.
   *
   * Comparing against the `q` already in the URL is the whole fix. On mount
   * they match and nothing happens; when someone types they diverge and the
   * push runs; after the push they match again and it settles.
   *
   * Dropping the page number stays correct -- but now it only happens when the
   * query genuinely changed, which is the case it was written for.
   */
  const activeQuery = searchParams.get('q') || '';

  useEffect(() => {
    const next = value.trim();
    if (next === activeQuery) return;

    const delayDebounceFn = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) {
        params.set('q', next);
      } else {
        params.delete('q');
      }
      params.delete('page'); // a new search starts at the first page

      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `/blog?${qs}` : '/blog');
      });
    }, 400); // 400ms debounce

    return () => clearTimeout(delayDebounceFn);
  }, [value, activeQuery, router, searchParams]);

  return (
    <div className="relative group w-full">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="SEARCH ARTICLES..."
        className="w-full bg-[#0f0f0f] text-xs font-bold uppercase tracking-[0.15em] text-white placeholder:text-zinc-600 px-5 py-4 pr-12 rounded-sm border border-zinc-900 focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all duration-300 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]"
      />
      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-[#D4AF37] transition-colors duration-300">
        {isPending ? (
          <Loader2 size={14} className="animate-spin text-[#D4AF37]" />
        ) : (
          <SearchIcon size={14} className="stroke-[3]" />
        )}
      </div>
    </div>
  );
}
