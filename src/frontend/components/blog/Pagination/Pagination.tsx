'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  totalPages: number;
}

/**
 * Page links, not page buttons.
 *
 * These were `<button onClick={router.push}>`, which means a crawler following
 * /blog saw no route to page two at all -- every article past the sixth was
 * reachable only from the sitemap. Same failure the tag cloud had: a control
 * that navigates has to be an anchor, or only a browser running JavaScript can
 * follow it.
 *
 * `q` and `tag` are carried through so paging inside a search keeps the search.
 */
export function Pagination({ totalPages }: PaginationProps) {
  const searchParams = useSearchParams();

  const raw = Number(searchParams.get('page'));
  const currentPage = Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;

  if (totalPages <= 1) return null;

  const hrefFor = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) params.delete('page');
    else params.set('page', String(page));
    const qs = params.toString();
    return qs ? `/blog?${qs}` : '/blog';
  };

  const box =
    'h-10 w-10 rounded-full flex items-center justify-center transition-colors duration-300';
  const idle =
    'bg-[#0f0f0f] text-zinc-400 border border-zinc-900 hover:border-[#D4AF37] hover:text-[#D4AF37]';
  const disabled = 'bg-[#0f0f0f] border border-zinc-900 text-zinc-700 opacity-30 pointer-events-none';

  return (
    <nav
      aria-label="Blog pages"
      className="flex items-center justify-center gap-2.5 pt-12 border-t border-zinc-900/60 mt-12"
    >
      {currentPage > 1 ? (
        <Link href={hrefFor(currentPage - 1)} rel="prev" aria-label="Previous page" className={`${box} ${idle}`}>
          <ChevronLeft size={14} className="stroke-[2.5]" />
        </Link>
      ) : (
        <span aria-hidden="true" className={`${box} ${disabled}`}>
          <ChevronLeft size={14} className="stroke-[2.5]" />
        </span>
      )}

      {Array.from({ length: totalPages }, (_, i) => i + 1).map((i) => {
        const isActive = i === currentPage;
        return (
          <Link
            key={i}
            href={hrefFor(i)}
            aria-label={`Page ${i}`}
            aria-current={isActive ? 'page' : undefined}
            className={`${box} font-mono text-xs font-bold ${
              isActive
                ? 'bg-[#D4AF37] text-black shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                : idle
            }`}
          >
            {i}
          </Link>
        );
      })}

      {currentPage < totalPages ? (
        <Link href={hrefFor(currentPage + 1)} rel="next" aria-label="Next page" className={`${box} ${idle}`}>
          <ChevronRight size={14} className="stroke-[2.5]" />
        </Link>
      ) : (
        <span aria-hidden="true" className={`${box} ${disabled}`}>
          <ChevronRight size={14} className="stroke-[2.5]" />
        </span>
      )}
    </nav>
  );
}
