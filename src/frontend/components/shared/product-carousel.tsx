'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { scrollBehavior } from '@/frontend/lib/motion';

interface ProductCarouselProps {
  children: React.ReactNode;
}

export function ProductCarousel({ children }: ProductCarouselProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = React.useState(false);
  const [showRight, setShowRight] = React.useState(true);

  const checkScroll = React.useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    // Show left button if we are scrolled at least 10px to the right
    setShowLeft(el.scrollLeft > 10);

    // Show right button if we haven't reached the end of the scrollable area
    const reachedEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 10;
    setShowRight(!reachedEnd);
  }, []);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Check scroll position on mount and window resize
    checkScroll();
    window.addEventListener('resize', checkScroll);

    return () => {
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll]);

  const handleScroll = (direction: 'left' | 'right') => {
    const el = containerRef.current;
    if (!el) return;

    // Scroll by 75% of the visible container width for standard paging
    const scrollAmount = el.clientWidth * 0.75;
    const targetScroll = el.scrollLeft + (direction === 'left' ? -scrollAmount : scrollAmount);

    el.scrollTo({
      left: targetScroll,
      // A media query cannot reach a scroll option. `globals.css` handles the
      // `scroll-smooth` class on this same element; this handles the argument.
      behavior: scrollBehavior(),
    });
  };

  return (
    <div className="relative group/carousel w-full">
      {/* Scroll Container */}
      <div
        ref={containerRef}
        onScroll={checkScroll}
        className="flex gap-6 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scroll-smooth snap-x"
      >
        {children}
      </div>

      {/* Navigation Buttons - Left */}
      {showLeft && (
        <button
          onClick={() => handleScroll('left')}
          aria-label="Scroll left"
          className="absolute left-2 top-[35%] -translate-y-1/2 z-20 h-10 w-10 flex items-center justify-center rounded-full bg-white/95 dark:bg-zinc-900/95 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 shadow-md md:shadow-lg hover:scale-105 active:scale-95 hover:bg-white dark:hover:bg-zinc-850 hover:text-amber-600 transition-all cursor-pointer opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      {/* Navigation Buttons - Right */}
      {showRight && (
        <button
          onClick={() => handleScroll('right')}
          aria-label="Scroll right"
          className="absolute right-2 top-[35%] -translate-y-1/2 z-20 h-10 w-10 flex items-center justify-center rounded-full bg-white/95 dark:bg-zinc-900/95 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 shadow-md md:shadow-lg hover:scale-105 active:scale-95 hover:bg-white dark:hover:bg-zinc-850 hover:text-amber-600 transition-all cursor-pointer opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
