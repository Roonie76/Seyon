'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface MarketplaceFiltersProps {
  categories: { name: string; count: number }[];
  selectedCategory: string;
  sort: string;
  minPrice: string;
  maxPrice: string;
  query: string;
}

export function MarketplaceFilters({
  categories,
  selectedCategory,
  sort,
  minPrice,
  maxPrice,
  query,
}: MarketplaceFiltersProps) {
  const router = useRouter();

  const handleFilterChange = (category: string, newSort: string, minP: string, maxP: string) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (category) params.set('category', category);
    if (newSort) params.set('sort', newSort);
    if (minP) params.set('minPrice', minP);
    if (maxP) params.set('maxPrice', maxP);

    router.push(`/marketplace?${params.toString()}`);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-end justify-between w-full bg-card p-4 rounded-xl border border-zinc-200 shadow-sm mb-8 text-foreground">
      <div className="flex flex-wrap gap-4 items-center w-full sm:w-auto">
        {/* Category Dropdown */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">Category</span>
          <select
            value={selectedCategory}
            onChange={(e) => handleFilterChange(e.target.value, sort, minPrice, maxPrice)}
            className="h-9 rounded-lg border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.name} value={cat.name}>
                {cat.name} ({cat.count})
              </option>
            ))}
          </select>
        </div>

        {/* Price Filters */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">Price Range</span>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const minP = (fd.get('minPrice') as string) || '';
              const maxP = (fd.get('maxPrice') as string) || '';
              handleFilterChange(selectedCategory, sort, minP, maxP);
            }}
            className="flex items-center gap-1.5"
          >
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-xs text-muted-foreground/60 font-semibold">₹</span>
              <input
                type="number"
                name="minPrice"
                defaultValue={minPrice}
                placeholder="Min"
                className="w-20 h-9 pl-5 pr-1.5 border border-zinc-200 bg-white rounded-lg text-xs text-zinc-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
              />
            </div>
            <span className="text-muted-foreground text-xs font-bold">—</span>
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-xs text-muted-foreground/60 font-semibold">₹</span>
              <input
                type="number"
                name="maxPrice"
                defaultValue={maxPrice}
                placeholder="Max"
                className="w-20 h-9 pl-5 pr-1.5 border border-zinc-200 bg-white rounded-lg text-xs text-zinc-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
              />
            </div>
            <Button type="submit" size="sm" variant="outline" className="h-9 text-xs rounded-lg px-3">
              Apply
            </Button>
          </form>
        </div>
      </div>

      {/* Sort Dropdown */}
      <div className="flex flex-col gap-1 w-full sm:w-auto">
        <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">Sort By</span>
        <select
          value={sort}
          onChange={(e) => handleFilterChange(selectedCategory, e.target.value, minPrice, maxPrice)}
          className="h-9 rounded-lg border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
        >
          <option value="newest">Newest First</option>
          <option value="price-asc">Price: Low to High</option>
          <option value="price-desc">Price: High to Low</option>
        </select>
      </div>
    </div>
  );
}
