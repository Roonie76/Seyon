'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';

export function HomepageSearch() {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [isOpen, setIsOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  
  const containerRef = React.useRef<HTMLDivElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close suggestions dropdown if clicking outside
  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const fetchSuggestions = React.useCallback((q: string) => {
    abortRef.current?.abort(); // Cancel outstanding keystroke requests
    if (q.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    
    fetch(`/api/search-suggestions?q=${encodeURIComponent(q)}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        setSuggestions(data.suggestions ?? []);
        setIsOpen(true);
        setActiveIndex(-1);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') console.error(err);
      });
  }, []);

  const onChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 300);
  };

  const goToSearch = (q: string) => {
    if (q.trim()) {
      router.push(`/?q=${encodeURIComponent(q.trim())}`);
      setIsOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        goToSearch(suggestions[activeIndex]);
      } else {
        goToSearch(query);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      setActiveIndex((prev) => (prev + 1 < suggestions.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsOpen(true);
      setActiveIndex((prev) => (prev - 1 >= 0 ? prev - 1 : suggestions.length - 1));
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-xl mx-auto z-30">
      {/* Search Input Container */}
      <div className="flex items-center bg-white border border-zinc-200 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 rounded-full px-5 py-3 transition-all duration-300 shadow-sm">
        <Search className="h-5 w-5 text-zinc-500 shrink-0 mr-3" />
        <input
          type="text"
          placeholder="Search products, crafts, categories..."
          value={query}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0) setIsOpen(true); }}
          className="w-full bg-transparent border-none outline-none text-zinc-900 placeholder-zinc-400 text-sm md:text-base py-0.5"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setSuggestions([]);
              setIsOpen(false);
            }}
            className="text-zinc-450 hover:text-zinc-650 transition-colors p-1"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => goToSearch(query)}
          className="ml-3 px-5 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:brightness-105 active:scale-95 text-black font-extrabold text-xs md:text-sm rounded-full shadow-md transition-all uppercase tracking-wider shrink-0"
        >
          Go
        </button>
      </div>

      {/* Autocomplete Dropdown List */}
      {isOpen && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 mt-2.5 border border-zinc-200 rounded-2xl bg-white/95 backdrop-blur-md shadow-xl overflow-hidden divide-y divide-zinc-100 animate-fade-in p-1">
          {suggestions.map((s, idx) => (
            <li
              key={s}
              onClick={() => goToSearch(s)}
              onMouseEnter={() => setActiveIndex(idx)}
              className={`flex items-center px-5 py-3 text-xs md:text-sm cursor-pointer transition-colors font-medium rounded-xl ${
                activeIndex === idx
                  ? 'bg-zinc-50 text-amber-700 font-semibold'
                  : 'text-zinc-700'
              }`}
            >
              <Search className="h-3.5 w-3.5 mr-3 text-zinc-400 shrink-0" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
