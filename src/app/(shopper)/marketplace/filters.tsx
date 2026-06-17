'use client';

import * as React from 'react';
import {
  SlidersHorizontal,
  Check,
  ChevronDown,
  RotateCcw,
  MapPin,
  Layers,
  ArrowUpDown,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PriceRangeSlider } from '@/components/ui/price-range-slider';
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
    <div ref={containerRef} className="relative flex flex-col gap-1 w-full sm:w-auto min-w-[150px]">
      <label htmlFor={id} className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider select-none">
        {label}
      </label>
      <button
        id={id}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-2 h-9 w-full sm:w-auto rounded-lg border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-amber-500 hover:border-amber-500/50 hover:bg-zinc-50 transition-all cursor-pointer font-semibold text-left"
      >
        <span className="flex items-center gap-1.5 truncate max-w-[130px]">
          {icon && <span className="text-zinc-400 shrink-0">{icon}</span>}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        </span>
        <ChevronDown className={`h-3 w-3 text-zinc-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 w-full sm:w-56 bg-white rounded-xl border border-zinc-200 shadow-xl py-1 z-40 max-h-60 overflow-y-auto animate-fade-in">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`flex items-center justify-between w-full text-left px-3 py-2 text-xs hover:bg-amber-50/50 hover:text-amber-900 transition-colors font-medium ${
                value === opt.value ? 'bg-amber-50/70 text-amber-950 font-bold' : 'text-zinc-800'
              }`}
            >
              <span className="truncate pr-2">{opt.label}</span>
              <span className="flex items-center gap-1.5 shrink-0">
                {opt.count !== undefined && (
                  <span className="text-[10px] text-muted-foreground bg-zinc-100 rounded-full px-1.5 py-0.5">
                    {opt.count}
                  </span>
                )}
                {value === opt.value && <Check className="h-3 w-3 text-amber-600" />}
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
  query,
  applyFilters,
}: MarketplaceFiltersProps) {
  // Price state for slider
  const defaultMax = 50000;
  const [sliderRange, setSliderRange] = React.useState<[number, number]>([
    minPrice ? parseFloat(minPrice) : 0,
    maxPrice ? parseFloat(maxPrice) : defaultMax,
  ]);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // Sync slider range when price props change (e.g. from filter clearing chips)
  React.useEffect(() => {
    setSliderRange([
      minPrice ? parseFloat(minPrice) : 0,
      maxPrice ? parseFloat(maxPrice) : defaultMax,
    ]);
  }, [minPrice, maxPrice]);

  const handlePriceCommit = (val: [number, number]) => {
    applyFilters({
      minPrice: val[0] > 0 ? val[0].toString() : '',
      maxPrice: val[1] < defaultMax ? val[1].toString() : '',
    });
  };

  const handlePriceReset = () => {
    setSliderRange([0, defaultMax]);
    applyFilters({ minPrice: '', maxPrice: '' });
  };

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
      <div className={`flex ${isMobile ? 'flex-col gap-6' : 'flex-wrap gap-5 items-center'}`}>
        {/* Category Combobox */}
        <CustomSelect
          id={isMobile ? 'mobile-filter-category' : 'filter-category'}
          label="Category"
          value={selectedCategory}
          options={categoryOptions}
          onChange={(val) => applyFilters({ category: val })}
          icon={<Layers className="h-3.5 w-3.5" />}
          placeholder="All Categories"
        />

        {/* Seller Location Combobox */}
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

        {/* Price Range Slider */}
        <div className="flex flex-col gap-1 w-full sm:w-48">
          <div className="flex justify-between items-center select-none">
            <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">
              Price Range
            </span>
            <span className="text-[10px] font-bold text-amber-700">
              ₹{sliderRange[0]} - ₹{sliderRange[1] === defaultMax ? '50k+' : sliderRange[1]}
            </span>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <PriceRangeSlider
              min={0}
              max={defaultMax}
              step={100}
              value={sliderRange}
              onValueChange={setSliderRange}
              onValueCommit={handlePriceCommit}
            />
            {(minPrice || maxPrice) && (
              <button
                type="button"
                onClick={handlePriceReset}
                title="Reset Price"
                className="text-muted-foreground hover:text-red-650 transition-colors p-0.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* In-Stock Toggle */}
        <label className={`flex items-center gap-2 text-xs font-semibold text-foreground/80 cursor-pointer select-none ${isMobile ? 'py-2 border-y border-zinc-100' : 'self-end pb-2'}`}>
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => applyFilters({ inStock: e.target.checked })}
            className="h-4.5 w-4.5 accent-amber-500 rounded border-zinc-350 cursor-pointer"
          />
          In stock only
        </label>

        {/* Sort By Dropdown */}
        <div className={isMobile ? '' : 'ml-auto'}>
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
    <div className="w-full mb-8">
      {/* Desktop Filter Panel: Hidden on mobile (under md) */}
      <div className="hidden md:flex flex-col gap-4 w-full bg-card p-4 rounded-xl border border-zinc-200 shadow-sm text-foreground">
        {renderFiltersList()}
      </div>

      {/* Mobile Filter Button and Modal (Hidden on Desktop) */}
      <div className="flex md:hidden items-center justify-between w-full gap-3">
        <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
          <DialogTrigger>
            <Button
              variant="outline"
              className="flex items-center justify-center gap-2 h-10 w-full text-sm font-semibold border-zinc-200 hover:border-amber-500/50 hover:bg-amber-50/10 text-zinc-800"
            >
              <SlidersHorizontal className="h-4 w-4 text-amber-500" />
              Filters & Sort {isFilterActive ? '(Active)' : ''}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Filter Listings</DialogTitle>
              <DialogDescription>
                Narrow down products by category, city, price range, or availability.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">{renderFiltersList(true)}</div>

            <DialogFooter>
              <div className="flex gap-2 w-full">
                {isFilterActive && (
                  <Button
                    variant="outline"
                    className="w-1/2 flex items-center justify-center gap-1.5"
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
                  className={`bg-amber-500 hover:bg-amber-600 text-black font-bold ${isFilterActive ? 'w-1/2' : 'w-full'}`}
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
