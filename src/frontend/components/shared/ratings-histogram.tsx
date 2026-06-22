'use client';

import * as React from 'react';
import { Star } from 'lucide-react';

interface Review {
  id: string;
  rating: number;
  comment: string;
  createdAt: Date;
}

interface RatingsHistogramProps {
  reviews: Review[];
}

export function RatingsHistogram({ reviews }: RatingsHistogramProps) {
  const total = reviews.length;

  // Calculate counts for each star level (1 to 5)
  const distribution = React.useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((r) => {
      const rating = Math.round(r.rating) as 5 | 4 | 3 | 2 | 1;
      if (counts[rating] !== undefined) {
        counts[rating]++;
      }
    });

    return Object.entries(counts)
      .map(([stars, count]) => {
        const starNum = parseInt(stars, 10);
        const percent = total > 0 ? (count / total) * 100 : 0;
        return { stars: starNum, count, percent };
      })
      .reverse(); // Display 5 stars first down to 1 star
  }, [reviews, total]);

  if (total === 0) {
    return (
      <div className="text-center py-4 bg-zinc-50 dark:bg-zinc-900/10 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
        <p className="text-xs text-zinc-500 font-bold">No customer reviews yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 w-full select-none">
      {distribution.map(({ stars, count, percent }) => (
        <div key={stars} className="flex items-center gap-3 text-xs">
          {/* Star label */}
          <button className="flex items-center gap-1.5 font-bold hover:underline shrink-0 text-zinc-700 dark:text-zinc-300 w-12 text-left cursor-pointer">
            <span>{stars}</span>
            <Star className="h-3.5 w-3.5 fill-amber-500 stroke-amber-500" />
          </button>

          {/* Progress bar container */}
          <div className="flex-grow h-4 bg-zinc-100 dark:bg-zinc-800 rounded-md overflow-hidden relative border border-zinc-200/40 dark:border-zinc-700/30">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 dark:from-amber-600 dark:to-yellow-500 rounded-r-sm transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>

          {/* Percentage / Count label */}
          <span className="w-16 text-right font-extrabold text-zinc-500 dark:text-zinc-400 shrink-0">
            {Math.round(percent)}% ({count})
          </span>
        </div>
      ))}
    </div>
  );
}
