'use client';

import * as React from 'react';
import {
  SlidersHorizontal,
  Check,
  ChevronDown,
  MapPin,
  Layers,
  ArrowUpDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

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
  applyFilters: (next: Partial<FilterState>) => void;
}

interface FilterState {
  category: string;
  city: string;
  inStock: boolean;
  sort: string;
  minPrice: string;
  maxPrice: string;
}

// Custom Select Component with beautiful styling and hover states
interface CustomSelectProps {
  id: string;
  label: string;
  value: string;
  options: { label: string; value: string; count?: number }[];
  onChange: (value: string) => void;
  icon?: React.ReactNode;
  placeholder: string;
}

function CustomSelect({ id, label, value, options, onChange, icon, placeholder }: CustomSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1.5 w-full md:w-auto min-w-[160px]">
      <label htmlFor={id} className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider select-none">
        {label}
      </label>
      <button
        id={id}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-2 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 hover:border-zinc-300 hover:bg-zinc-50/50 transition-all cursor-pointer font-medium text-left shadow-sm"
      >
        <span className="flex items-center gap-2 truncate">
          {icon && <span className="text-zinc-400 shrink-0">{icon}</span>}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-zinc-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-zinc-600' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-[105%] left-0 mt-1 w-full md:w-60 bg-white rounded-xl border border-zinc-200 shadow-xl py-1 z-50 max-h-64 overflow-y-auto origin-top animate-in fade-in slide-in-from-top-1 duration-150">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`flex items-center justify-between w-full text-left px-3.5 py-2 text-xs hover:bg-zinc-50 transition-colors font-medium ${
                value === opt.value ? 'bg-amber-50/60 text-amber-900 font-semibold' : 'text-zinc-700'
              }`}
            >
              <span className="truncate pr-2">{opt.label}</span>
              <span className="flex items-center gap-1.5 shrink-0">
                {opt.count !== undefined && (
                  <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-100 rounded-md px-1.5 py-0.5">
                    {opt.count}
                  </span>
                )}
                {value === opt.value && <Check className="h-3.5 w-3.5 text-amber-600 stroke-[2.5]" />}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
  applyFilters,
}: MarketplaceFiltersProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const isFilterActive = selectedCategory || selectedCity || inStockOnly || minPrice || maxPrice;

  // Options lists
  const categoryOptions = [
    { label: 'All Categories', value: '' },
    ...categories.map((c) => ({
      label: c.name,
      value: c.name,
      count: c.count,
    })),
  ];

  const cityOptions = [
    { label: 'All Locations', value: '' },
    ...cities.map((city) => ({
      label: city,
      value: city,
    })),
  ];

  const sortOptions = [
    { label: 'Newest First', value: 'newest' },
    { label: 'Price: Low to High', value: 'price-asc' },
    { label: 'Price: High to Low', value: 'price-desc' },
  ];

  const renderFiltersList = (isMobile: boolean = false) => {
    return (
      <div className={`grid gap-5 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-[1fr_auto] items-end w-full'}`}>
        {/* Left Side Grouping: Controls */}
        <div className="flex flex-col md:flex-row flex-wrap gap-4 items-stretch md:items-end">
          {/* Category Dropdown */}
          <CustomSelect
            id={isMobile ? 'mobile-filter-category' : 'filter-category'}
            label="Category"
            value={selectedCategory}
            options={categoryOptions}
            onChange={(val) => applyFilters({ category: val })}
            icon={<Layers className="h-3.5 w-3.5" />}
            placeholder="All Categories"
          />

          {/* Seller Location Dropdown */}
          {cities.length > 0 && (
            <CustomSelect
              id={isMobile ? 'mobile-filter-city' : 'filter-city'}
              label="Location"
              value={selectedCity}
              options={cityOptions}
              onChange={(val) => applyFilters({ city: val })}
              icon={<MapPin className="h-3.5 w-3.5" />}
              placeholder="All Locations"
            />
          )}

          {/* Price Range Inputs */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider select-none">
              Price Range
            </span>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                applyFilters({
                  minPrice: (fd.get('minPrice') as string) || '',
                  maxPrice: (fd.get('maxPrice') as string) || '',
                });
              }}
              className="flex items-center gap-1.5 h-10"
            >
              <div className="relative">
                <span className="absolute left-2.5 top-2.5 text-xs text-zinc-400 font-semibold select-none">₹</span>
                <input
                  type="number"
                  name="minPrice"
                  aria-label="Minimum price"
                  key={minPrice}
                  defaultValue={minPrice}
                  placeholder="Min"
                  className="w-20 h-10 pl-5 pr-1.5 border border-zinc-200 bg-white rounded-lg text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 hover:border-zinc-300 transition-all font-medium shadow-sm"
                />
              </div>
              <span className="text-zinc-450 text-xs font-bold select-none">—</span>
              <div className="relative">
                <span className="absolute left-2.5 top-2.5 text-xs text-zinc-400 font-semibold select-none">₹</span>
                <input
                  type="number"
                  name="maxPrice"
                  aria-label="Maximum price"
                  key={maxPrice}
                  defaultValue={maxPrice}
                  placeholder="Max"
                  className="w-20 h-10 pl-5 pr-1.5 border border-zinc-200 bg-white rounded-lg text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 hover:border-zinc-300 transition-all font-medium shadow-sm"
                />
              </div>
              <Button type="submit" size="sm" variant="outline" className="h-10 text-xs rounded-lg px-3 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-800 font-semibold cursor-pointer shadow-sm">
                Apply
              </Button>
            </form>
          </div>

          {/* In-Stock Toggle */}
          <label className={`flex items-center gap-2.5 text-xs font-semibold text-zinc-700 cursor-pointer select-none h-10 px-1 hover:text-zinc-900 transition-colors ${isMobile ? 'py-4 border-y border-zinc-100 my-2' : ''}`}>
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => applyFilters({ inStock: e.target.checked })}
              className="h-4 w-4 accent-amber-500 rounded border-zinc-300 text-amber-600 focus:ring-amber-500/20 cursor-pointer"
            />
            In stock only
          </label>
        </div>

        {/* Right Side Grouping: Sorting (Aligned beautifully on Desktop) */}
        <div className={isMobile ? 'pt-2' : 'w-full lg:w-auto border-t lg:border-t-0 border-zinc-100 pt-4 lg:pt-0'}>
          <CustomSelect
            id={isMobile ? 'mobile-filter-sort' : 'filter-sort'}
            label="Sort By"
            value={sort}
            options={sortOptions}
            onChange={(val) => applyFilters({ sort: val })}
            icon={<ArrowUpDown className="h-3.5 w-3.5" />}
            placeholder="Newest First"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="w-full space-y-3 mb-8">
      {/* Desktop Filter Panel */}
      <div className="hidden md:block w-full bg-white p-5 rounded-xl border border-zinc-200 shadow-sm">
        {renderFiltersList()}
      </div>

      {/* Mobile Filter Trigger Button */}
      <div className="flex md:hidden items-center justify-between w-full gap-3">
        <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
          <DialogTrigger>
            <Button
              variant="outline"
              className="flex items-center justify-center gap-2 h-11 w-full text-sm font-semibold border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-800 shadow-sm"
            >
              <SlidersHorizontal className="h-4 w-4 text-amber-500" />
              Filters & Sort {isFilterActive ? '(Active)' : ''}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-xl">
            <DialogHeader>
              <DialogTitle>Filter Listings</DialogTitle>
              <DialogDescription>
                Narrow down products by category, city, price range, or availability.
              </DialogDescription>
            </DialogHeader>

            <div className="py-2">{renderFiltersList(true)}</div>

            <DialogFooter className="pt-4 border-t border-zinc-100">
              <div className="flex gap-3 w-full">
                {isFilterActive && (
                  <Button
                    variant="outline"
                    className="w-1/2 flex items-center justify-center gap-1.5 font-medium border-zinc-200"
                    onClick={() => {
                      applyFilters({
                        category: '',
                        city: '',
                        inStock: false,
                        minPrice: '',
                        maxPrice: '',
                      });
                      setMobileOpen(false);
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
                <Button
                  className={`bg-amber-500 hover:bg-amber-600 text-black font-semibold ${isFilterActive ? 'w-1/2' : 'w-full'}`}
                  onClick={() => setMobileOpen(false)}
                >
                  Show Results
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
