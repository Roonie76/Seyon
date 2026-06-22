'use client';

import * as React from 'react';
import { Search, ShoppingBag, Store, Tag, X, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface SuggestionItem {
  id?: string;
  title?: string;
  name?: string;
  slug: string;
  price?: number;
  shop?: {
    slug: string;
  };
}

interface SuggestionsState {
  categories: string[];
  shops: SuggestionItem[];
  products: SuggestionItem[];
}

interface SearchInputProps {
  initialQuery: string;
  onSearch: (q: string) => void;
}

export function MarketplaceSearchInput({ initialQuery, onSearch }: SearchInputProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = React.useState(initialQuery);
  const [suggestions, setSuggestions] = React.useState<SuggestionsState>({
    categories: [],
    shops: [],
    products: [],
  });
  const [loadingSuggestions, setLoadingSuggestions] = React.useState(false);
  const [showDropdown, setShowDropdown] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Debounce query input
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(handler);
  }, [query]);

  // Fetch suggestions when debounced query changes
  React.useEffect(() => {
    if (debouncedQuery.trim().length < 2) return;

    const fetchSuggestions = async () => {
      setLoadingSuggestions(true);
      try {
        const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(debouncedQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data);
        }
      } catch (err) {
        console.error('Failed to load search suggestions', err);
      } finally {
        setLoadingSuggestions(false);
      }
    };

    fetchSuggestions();
  }, [debouncedQuery]);

  // Handle outside clicks to close autocomplete
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowDropdown(false);
    onSearch(query);
  };

  const handleSuggestionClick = (url: string) => {
    setShowDropdown(false);
    router.push(url);
  };

  const clearSearch = () => {
    setQuery('');
    setSuggestions({ categories: [], shops: [], products: [] });
    onSearch('');
  };

  const hasSuggestions =
    suggestions.categories.length > 0 ||
    suggestions.shops.length > 0 ||
    suggestions.products.length > 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-lg z-30">
      <form onSubmit={handleSubmit} className="relative w-full">
        <Input
          type="text"
          value={query}
          onChange={(e) => {
            const val = e.target.value;
            setQuery(val);
            setShowDropdown(true);
            if (val.trim().length < 2) {
              setSuggestions({ categories: [], shops: [], products: [] });
            }
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder="Search products, stores, or categories..."
          className="pl-10 pr-24 h-12 rounded-full border-zinc-200 shadow-md bg-white text-foreground focus-visible:ring-amber-500 focus-visible:ring-2"
        />
        <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-muted-foreground" />

        <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
          {query && (
            <button
              type="button"
              onClick={clearSearch}
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-zinc-100 rounded-full transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <Button
            type="submit"
            size="sm"
            className="h-9 rounded-full px-5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:brightness-105 hover:shadow-md transition-all text-black font-bold border-none"
          >
            {loadingSuggestions ? (
              <Loader2 className="h-4 w-4 animate-spin text-black" />
            ) : (
              'Search'
            )}
          </Button>
        </div>
      </form>

      {/* Autocomplete Dropdown Card */}
      {showDropdown && (hasSuggestions || loadingSuggestions) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-zinc-200 shadow-xl overflow-hidden text-left z-50 animate-fade-in max-h-96 overflow-y-auto">
          {loadingSuggestions && !hasSuggestions && (
            <div className="flex items-center justify-center p-6 text-sm text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
              Searching suggestions...
            </div>
          )}

          {/* Categories Suggestions */}
          {suggestions.categories.length > 0 && (
            <div className="p-2 border-b border-zinc-100">
              <div className="flex items-center gap-1 text-[10px] uppercase font-extrabold text-muted-foreground px-3 py-1.5 tracking-wider">
                <Tag className="h-3 w-3" /> Categories
              </div>
              <div className="space-y-0.5">
                {suggestions.categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => handleSuggestionClick(`/marketplace?category=${encodeURIComponent(cat)}`)}
                    className="w-full text-left px-3 py-2 text-sm text-zinc-800 hover:bg-amber-50/50 hover:text-amber-900 rounded-lg transition-colors font-medium flex items-center gap-2"
                  >
                    <span>{cat}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stores Suggestions */}
          {suggestions.shops.length > 0 && (
            <div className="p-2 border-b border-zinc-100">
              <div className="flex items-center gap-1 text-[10px] uppercase font-extrabold text-muted-foreground px-3 py-1.5 tracking-wider">
                <Store className="h-3 w-3" /> Shops
              </div>
              <div className="space-y-0.5">
                {suggestions.shops.map((shop) => (
                  <button
                    key={shop.slug}
                    onClick={() => handleSuggestionClick(`/store/${shop.slug}`)}
                    className="w-full text-left px-3 py-2 text-sm text-zinc-800 hover:bg-amber-50/50 hover:text-amber-900 rounded-lg transition-colors font-medium flex items-center justify-between"
                  >
                    <span>{shop.name}</span>
                    <span className="text-xs text-muted-foreground font-normal">visit shop &rarr;</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Products Suggestions */}
          {suggestions.products.length > 0 && (
            <div className="p-2">
              <div className="flex items-center gap-1 text-[10px] uppercase font-extrabold text-muted-foreground px-3 py-1.5 tracking-wider">
                <ShoppingBag className="h-3 w-3" /> Products
              </div>
              <div className="space-y-0.5">
                {suggestions.products.map((prod) => (
                  <button
                    key={prod.id}
                    onClick={() => handleSuggestionClick(`/marketplace?q=${encodeURIComponent(prod.title || '')}`)}
                    className="w-full text-left px-3 py-2 text-sm text-zinc-800 hover:bg-amber-50/50 hover:text-amber-900 rounded-lg transition-colors font-medium flex items-center justify-between"
                  >
                    <span className="line-clamp-1">{prod.title}</span>
                    <span className="text-xs font-bold text-amber-700 shrink-0 ml-2">
                      ₹{prod.price?.toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
