import * as React from 'react';
import { Card } from './card';

export function ProductSkeleton() {
  return (
    <Card className="overflow-hidden h-full flex flex-col justify-between border-zinc-200 bg-card shadow-sm animate-pulse">
      {/* Aspect Video Image Area */}
      <div className="aspect-video bg-zinc-200/80" />

      {/* Details Area */}
      <div className="p-4 flex flex-col justify-between flex-grow">
        <div>
          {/* Category & Store row */}
          <div className="flex justify-between items-center gap-2 mb-3">
            <div className="h-3.5 bg-zinc-200 rounded w-16" />
            <div className="h-3.5 bg-zinc-200 rounded w-20" />
          </div>
          {/* Title */}
          <div className="h-5 bg-zinc-200 rounded w-3/4 mb-2" />
        </div>

        {/* Price and Badge row */}
        <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3">
          <div className="h-6 bg-zinc-200 rounded w-16" />
          <div className="h-5 bg-zinc-200 rounded w-24" />
        </div>
      </div>
    </Card>
  );
}

interface ProductSkeletonGridProps {
  count?: number;
}

export function ProductSkeletonGrid({ count = 8 }: ProductSkeletonGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, idx) => (
        <ProductSkeleton key={idx} />
      ))}
    </div>
  );
}
