'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { ProductSkeletonGrid } from '@/components/ui/product-skeleton';
import { MarketplaceSearchInput } from './search-input';
import { MarketplaceFilters } from './filters';
import { Button } from '@/components/ui/button';

interface FilterState {
  category: string;
  city: string;
  inStock: boolean;
  sort: string;
  minPrice: string;
  maxPrice: string;
  rating: string;
}

interface MarketplaceClientProps {
  categories: { name: string; count: number }[];
  selectedCategory: string;
  cities: string[];
  selectedCity: string;
  inStockOnly: boolean;
  sort: string;
  minPrice: string;
  maxPrice: string;
  rating: string;
  query: string;
  children: React.ReactNode;
}

export function MarketplaceClient({
  categories,
  selectedCategory,
  cities,
  selectedCity,
  inStockOnly,
  sort,
  minPrice,
  maxPrice,
  rating,
  query,
  children,
}: MarketplaceClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const parsedMin = parseFloat(minPrice);
  const parsedMax = parseFloat(maxPrice);
  const safeMinPrice = !isNaN(parsedMin) ? Math.max(0, parsedMin).toString() : '';
  const safeMaxPrice = !isNaN(parsedMax) ? Math.max(0, parsedMax).toString() : '';

  const current: FilterState = {
    category: selectedCategory,
    city: selectedCity,
    inStock: inStockOnly,
    sort,
    minPrice: safeMinPrice,
    maxPrice: safeMaxPrice,
    rating,
  };

  const getFilterUrl = (state: FilterState, newQuery: string = query) => {
    const params = new URLSearchParams();
    if (newQuery) params.set('q', newQuery);
    if (state.category) params.set('category', state.category);
    if (state.city) params.set('city', state.city);
    if (state.inStock) params.set('inStock', '1');
    if (state.sort) params.set('sort', state.sort);
    if (state.minPrice) params.set('minPrice', state.minPrice);
    if (state.maxPrice) params.set('maxPrice', state.maxPrice);
    if (state.rating) params.set('rating', state.rating);
    return `/?${params.toString()}`;
  };

  const handleApplyFilters = (next: Partial<FilterState>) => {
    const sanitizedNext = { ...next };
    if (next.minPrice !== undefined) {
      const p = parseFloat(next.minPrice);
      sanitizedNext.minPrice = !isNaN(p) ? Math.max(0, p).toString() : '';
    }
    if (next.maxPrice !== undefined) {
      const p = parseFloat(next.maxPrice);
      sanitizedNext.maxPrice = !isNaN(p) ? Math.max(0, p).toString() : '';
    }
    const nextState = { ...current, ...sanitizedNext };
    const nextUrl = getFilterUrl(nextState);
    startTransition(() => {
      router.push(nextUrl);
    });
  };

  const handleSearch = (newQuery: string) => {
    const nextUrl = getFilterUrl(current, newQuery);
    startTransition(() => {
      router.push(nextUrl);
    });
  };

  // Determine active chips
  const activeChips: { label: string; onClear: () => void }[] = [];

  if (query) {
    activeChips.push({
      label: `Search: "${query}"`,
      onClear: () => handleSearch(''),
    });
  }
  if (selectedCategory) {
    activeChips.push({
      label: `Category: ${selectedCategory}`,
      onClear: () => handleApplyFilters({ category: '' }),
    });
  }
  if (selectedCity) {
    activeChips.push({
      label: `City: ${selectedCity}`,
      onClear: () => handleApplyFilters({ city: '' }),
    });
  }
  if (inStockOnly) {
    activeChips.push({
      label: 'In Stock Only',
      onClear: () => handleApplyFilters({ inStock: false }),
    });
  }
  if (safeMinPrice || safeMaxPrice) {
    let priceLabel = 'Price: ';
    if (safeMinPrice && safeMaxPrice) {
      priceLabel += `₹${safeMinPrice} - ₹${safeMaxPrice}`;
    } else if (safeMinPrice) {
      priceLabel += `≥ ₹${safeMinPrice}`;
    } else {
      priceLabel += `≤ ₹${safeMaxPrice}`;
    }
    activeChips.push({
      label: priceLabel,
      onClear: () => handleApplyFilters({ minPrice: '', maxPrice: '' }),
    });
  }
  if (rating) {
    activeChips.push({
      label: `Rating: ${rating}★ & Up`,
      onClear: () => handleApplyFilters({ rating: '' }),
    });
  }

  const handleClearAll = () => {
    startTransition(() => {
      router.push('/');
    });
  };

  return (
    <div className="flex flex-col w-full">


      {/* Advanced Filters */}
      <MarketplaceFilters
        categories={categories}
        selectedCategory={selectedCategory}
        cities={cities}
        selectedCity={selectedCity}
        inStockOnly={inStockOnly}
        sort={sort}
        minPrice={safeMinPrice}
        maxPrice={safeMaxPrice}
        rating={rating}
        query={query}
        applyFilters={handleApplyFilters}
      />

      {/* Active Filter Chips */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6 animate-fade-in">
          <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            Active Filters:
          </span>
          {activeChips.map((chip, idx) => (
            <div
              key={idx}
              className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-900 border border-amber-500/20 rounded-full px-3 py-1 text-xs font-semibold"
            >
              <span>{chip.label}</span>
              <button
                type="button"
                onClick={chip.onClear}
                className="hover:bg-amber-500/20 rounded-full p-0.5 transition-colors cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="text-xs font-bold text-muted-foreground hover:text-crimson h-8 px-2.5 rounded-lg"
          >
            Clear All
          </Button>
        </div>
      )}

      {/* Products Display Container */}
      <div className="relative min-h-[400px]">
        {/* Shimmer loading overlay or render children */}
        {isPending ? (
          <div className="space-y-6">
            <div className="h-5 bg-zinc-100 animate-pulse rounded w-48 mb-6" />
            <ProductSkeletonGrid count={8} />
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
