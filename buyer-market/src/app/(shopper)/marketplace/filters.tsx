'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface MarketplaceFiltersProps {
  categories: { name: string; count: number }[];
  selectedCategory: string;
  cities: string[];
  selectedCity: string;
  inStockOnly: boolean;
  sort: string;
  minPrice: string;
  maxPrice: string;
  query: string;
}

interface FilterState {
  category: string;
  city: string;
  inStock: boolean;
  sort: string;
  minPrice: string;
  maxPrice: string;
}

export function MarketplaceFilters({
  categories,
  selectedCategory,
  cities,
  selectedCity,
  inStockOnly,
  sort,
  minPrice,
  maxPrice,
  query,
}: MarketplaceFiltersProps) {
  const router = useRouter();

  const current: FilterState = {
    category: selectedCategory,
    city: selectedCity,
    inStock: inStockOnly,
    sort,
    minPrice,
    maxPrice,
  };

  const applyFilters = (next: Partial<FilterState>) => {
    const state = { ...current, ...next };
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (state.category) params.set('category', state.category);
    if (state.city) params.set('city', state.city);
    if (state.inStock) params.set('inStock', '1');
    if (state.sort) params.set('sort', state.sort);
    if (state.minPrice) params.set('minPrice', state.minPrice);
    if (state.maxPrice) params.set('maxPrice', state.maxPrice);

    router.push(`/marketplace?${params.toString()}`);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-end justify-between w-full bg-card p-4 rounded-xl border border-zinc-200 shadow-sm mb-8 text-foreground">
      <div className="flex flex-wrap gap-4 items-center w-full sm:w-auto">
        {/* Category Dropdown */}
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-category" className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">Category</label>
          <select
            id="filter-category"
            value={selectedCategory}
            onChange={(e) => applyFilters({ category: e.target.value })}
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

        {/* City Dropdown */}
        {cities.length > 0 && (
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-city" className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">Seller Location</label>
            <select
              id="filter-city"
              value={selectedCity}
              onChange={(e) => applyFilters({ city: e.target.value })}
              className="h-9 rounded-lg border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
            >
              <option value="">All Locations</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Price Filters */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">Price Range</span>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              applyFilters({
                minPrice: (fd.get('minPrice') as string) || '',
                maxPrice: (fd.get('maxPrice') as string) || '',
              });
            }}
            className="flex items-center gap-1.5"
          >
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-xs text-muted-foreground/60 font-semibold">₹</span>
              <input
                type="number"
                name="minPrice"
                aria-label="Minimum price"
                defaultValue={minPrice}
                placeholder="Min"
                className="w-20 h-9 pl-5 pr-1.5 border border-zinc-200 bg-white rounded-lg text-xs text-zinc-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
              />
            </div>
            <span className="text-muted-foreground text-xs font-bold"