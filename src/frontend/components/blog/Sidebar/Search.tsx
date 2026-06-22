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

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) {
        params.set('q', value.trim());
      } else {
        params.delete('q');
      }
      params.delete('page'); // reset page on search

      startTransition(() => {
        router.push(`/blog?${params.toString()}`);
      });
    }, 400); // 400ms debounce

    return () => clearTimeout(delayDebounceFn);
  }, [value, router, searchParams]);

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
