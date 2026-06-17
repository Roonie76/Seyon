'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { X, SlidersHorizontal } from 'lucide-react';
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
  query,
  children,
}: MarketplaceClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const current: FilterState = {
    category: selectedCategory,
    city: selectedCity,
    inStock: inStockOnly,
    sort,
    minPrice,
    maxPrice,
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
    return `/marketplace?${params.toString()}`;
  };

  const handleApplyFilters = (next: Partial<FilterState>) => {
    const nextState = { ...current, ...next };
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
  if (minPrice || maxPrice) {
    let priceLabel = 'Price: ';
    if (minPrice && maxPrice) {
      priceLabel += `₹${minPrice} - ₹${maxPrice}`;
    } else if (minPrice) {
      priceLabel += `≥ ₹${minPrice}`;
    } else {
      priceLabel += `≤ ₹${maxPrice}`;
    }
    activeChips.push({
      label: priceLabel,
      onClear: () => handleApplyFilters({ minPrice: '', maxPrice: '' }),
    });
  }

  const handleClearAll = () => {
    startTransition(() => {
      router.push('/marketplace');
    });
  };

  return (
    <div className="flex flex-col w-full">
      {/* Header Banner */}
      <div className="relative rounded-2xl border border-amber-500/20 bg-gradient-to-b from-amber-500/5 to-amber-600/10 p-8 md:p-12 mb-12 overflow-hidden flex flex-col items-center text-center bg-card shadow-sm w-full">
        <div className="absolute top-0 left-0 w-60 h-60 bg-amber-500/5 rounded-full blur-[80px] pointer-events-none" />
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tight mb-4 animate-fade-in">
          Discover Seyon Marketplace
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base max-w-xl mx-auto mb-6">
          Find products listed by independent creators globally. Buy securely by connecting with them directly on chat.
        </p>
        <MarketplaceSearchInput initialQuery={query} onSearch={handleSearch} />
      </div>

      {/* Advanced Filters */}
      <MarketplaceFilters
        categories={categories}
        selectedCategory={selectedCategory}
        cities={cities}
        selectedCity={selectedCity}
        inStockOnly={inStockOnly}
        sort={sort}
        minPrice={minPrice}
        maxPrice={maxPrice}
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
            className="text-xs font-bold text-muted-foreground hover:text-red-650 h-8 px-2.5 rounded-lg"
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
