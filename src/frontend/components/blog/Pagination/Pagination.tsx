'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  totalPages: number;
}

export function Pagination({ totalPages }: PaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPage = Number(searchParams.get('page') || '1');

  if (totalPages <= 1) return null;

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    router.push(`/blog?${params.toString()}`);
  };

  const renderPageNumbers = () => {
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      const isActive = i === currentPage;
      pages.push(
        <button
          key={i}
          type="button"
          onClick={() => handlePageChange(i)}
          className={`h-10 w-10 rounded-full font-mono text-xs font-bold transition-all duration-300 ${
            isActive
              ? 'bg-[#D4AF37] text-black shadow-[0_0_15px_rgba(212,175,55,0.3)]'
              : 'bg-[#0f0f0f] text-zinc-400 border border-zinc-900 hover:border-[#D4AF37] hover:text-[#D4AF37]'
          }`}
        >
          {i}
        </button>
      );
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-center gap-2.5 pt-12 border-t border-zinc-900/60 mt-12">
      {/* Prev */}
      <button
        type="button"
        disabled={currentPage === 1}
        onClick={() => handlePageChange(currentPage - 1)}
        className="h-10 w-10 rounded-full bg-[#0f0f0f] border border-zinc-900 flex items-center justify-center text-zinc-400 hover:border-[#D4AF37] hover:text-[#D4AF37] disabled:opacity-30 disabled:hover:border-zinc-900 disabled:hover:text-zinc-400 transition-colors duration-300"
      >
        <ChevronLeft size={14} className="stroke-[2.5]" />
      </button>

      {/* Page Numbers */}
      {renderPageNumbers()}

      {/* Next */}
      <button
        type="button"
        disabled={currentPage === totalPages}
        onClick={() => handlePageChange(currentPage + 1)}
        className="h-10 w-10 rounded-full bg-[#0f0f0f] border border-zinc-900 flex items-center justify-center text-zinc-400 hover:border-[#D4AF37] hover:text-[#D4AF37] disabled:opacity-30 disabled:hover:border-zinc-900 disabled:hover:text-zinc-400 transition-colors duration-300"
      >
        <ChevronRight size={14} className="stroke-[2.5]" />
      </button>
    </div>
  );
}
