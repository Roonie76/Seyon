'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, Search, X, Heart, ChevronRight, User } from 'lucide-react';

interface NavbarClientProps {
  user?: {
    name?: string | null;
    email?: string | null;
    role?: string;
  };
  wishlistCount: number;
  buyerMarketUrl: string;
}

interface Suggestion {
  categories: { name: string; count: number }[];
  shops: { name: string; slug: string; logo: string | null }[];
  products: { id: string; title: string; slug: string; price: number; shopSlug: string }[];
}

export function NavbarClient({ user, wishlistCount, buyerMarketUrl }: NavbarClientProps) {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [suggestions, setSuggestions] = React.useState<Suggestion | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Focus search input when opened
  React.useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Fetch search suggestions
  React.useEffect(() => {
    if (!searchQuery.trim()) return;

    const delayDebounce = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data);
        }
      } catch (err) {
        console.error('Failed to load suggestions:', err);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/marketplace?q=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  };

  const closeAll = () => {
    setIsMenuOpen(false);
    setIsSearchOpen(false);
    setSearchQuery('');
    setSuggestions(null);
  };

  return (
    <>
      {/* Header element */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-secondary text-secondary-foreground shadow-sm transition-colors duration-300">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 relative">
          
          {/* Left Side: Menu & Search */}
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              onClick={() => { setIsMenuOpen(true); setIsSearchOpen(false); }}
              className="flex items-center gap-1.5 text-zinc-300 hover:text-white transition-colors uppercase font-semibold text-[10px] sm:text-xs tracking-widest cursor-pointer"
            >
              <Menu className="h-4 w-4 stroke-[1.5]" />
              <span className="hidden xs:inline">Menu</span>
            </button>
            <button
              onClick={() => { setIsSearchOpen(prev => !prev); setIsMenuOpen(false); }}
              className="flex items-center gap-1.5 text-zinc-300 hover:text-white transition-colors uppercase font-semibold text-[10px] sm:text-xs tracking-widest cursor-pointer"
            >
              <Search className="h-4 w-4 stroke-[1.5]" />
              <span className="hidden xs:inline">Search</span>
            </button>
          </div>

          {/* Middle: Logo (centered) */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <Link
              href="/"
              className="text-xl sm:text-2xl font-bold font-sans tracking-tight text-white flex items-center gap-0.5 group"
            >
              <span>seyon</span>
            </Link>
          </div>

           {/* Right Side: Account, Wishlist */}
           <div className="flex items-center gap-4 sm:gap-6">
              {user ? (
                <Link
                  href="/account"
                  className="p-0.5 text-zinc-300 hover:text-primary transition-colors flex items-center justify-center"
                  title="My Account"
                >
                  <User className="h-5 w-5 stroke-[1.5]" />
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800 hover:text-white px-3 py-1 text-[11px] sm:text-xs font-semibold text-zinc-350 transition-all shadow-sm active:scale-95 cursor-pointer"
                  title="Login or Sign Up"
                >
                  <span className="xs:hidden">Login</span>
                  <span className="hidden xs:inline">Login / Sign Up</span>
                </Link>
              )}
             <Link
               href={`${buyerMarketUrl}/wishlist`}
               className="relative p-0.5 text-zinc-300 hover:text-rose-500 transition-colors flex items-center justify-center"
               title="My Wishlist"
             >
               <Heart className="h-5 w-5 stroke-[1.5]" />
               {wishlistCount > 0 && (
                 <span className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-rose-500 text-[9px] text-white font-extrabold rounded-full flex items-center justify-center">
                   {wishlistCount}
                 </span>
               )}
             </Link>
           </div>
        </div>

        {/* Slide-Down Search Panel */}
        {isSearchOpen && (
          <div className="border-t border-zinc-800 bg-secondary animate-slide-down shadow-md">
            <div className="container mx-auto px-4 py-4 sm:px-6">
              <form onSubmit={handleSearchSubmit} className="flex gap-3 items-center relative">
                <Search className="h-5 w-5 text-zinc-400 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search products, brands, categories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent border-0 outline-0 focus:ring-0 text-sm text-zinc-100 placeholder-zinc-500 py-1"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(''); setSuggestions(null); }}
                    className="text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-black rounded text-xs font-semibold uppercase tracking-wider transition-colors"
                >
                  Go
                </button>
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(false)}
                  className="text-zinc-400 hover:text-white font-semibold p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </form>

              {/* Suggestions dropdown */}
              {suggestions && (
                <div className="mt-4 border border-zinc-800 rounded-lg bg-zinc-900 shadow-xl max-h-[350px] overflow-y-auto divide-y divide-zinc-800 p-2 animate-fade-in z-50">
                  {/* Categories */}
                  {suggestions.categories.length > 0 && (
                    <div className="py-2 px-3">
                      <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Categories</span>
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        {suggestions.categories.map((cat) => (
                          <Link
                            key={cat.name}
                            href={`/marketplace?category=${encodeURIComponent(cat.name)}`}
                            onClick={closeAll}
                            className="text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-full px-2.5 py-1 text-zinc-300 hover:text-primary transition-colors font-medium"
                          >
                            {cat.name} ({cat.count})
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Shops */}
                  {suggestions.shops.length > 0 && (
                    <div className="py-2 px-3">
                      <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Storefronts</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1.5">
                        {suggestions.shops.map((shop) => (
                          <Link
                            key={shop.slug}
                            href={`/store/${shop.slug}`}
                            onClick={closeAll}
                            className="flex items-center gap-2.5 p-1.5 rounded-md hover:bg-zinc-850 transition-colors"
                          >
                            {shop.logo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={shop.logo} alt={shop.name} className="h-6 w-6 rounded-full object-cover border border-zinc-800" />
                            ) : (
                              <div className="h-6 w-6 rounded-full bg-zinc-850 flex items-center justify-center text-[10px] font-bold text-zinc-300">
                                {shop.name[0].toUpperCase()}
                              </div>
                            )}
                            <span className="text-xs font-semibold text-zinc-200 hover:text-primary transition-colors">{shop.name}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Products */}
                  {suggestions.products.length > 0 && (
                    <div className="py-2 px-3">
                      <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Products</span>
                      <div className="space-y-1 mt-1.5">
                        {suggestions.products.map((prod) => (
                          <Link
                            key={prod.id}
                            href={`/store/${prod.shopSlug}/${prod.slug}`}
                            onClick={closeAll}
                            className="flex items-center justify-between text-xs p-2 rounded-md hover:bg-zinc-850 text-zinc-200 hover:text-primary font-medium transition-colors"
                          >
                            <span>{prod.title}</span>
                            <span className="font-bold text-zinc-300">₹{prod.price.toFixed(2)}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Menu Drawer Drawer overlay */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 animate-fade-in"
            onClick={() => setIsMenuOpen(false)}
            onKeyDown={(e) => { if (e.key === 'Escape') setIsMenuOpen(false); }}
            role="button"
            tabIndex={-1}
            aria-label="Close menu"
          />

          {/* Drawer Body */}
          <div className="relative flex w-full max-w-xs flex-col bg-zinc-950 text-zinc-250 shadow-2xl border-r border-zinc-900 animate-slide-right py-6 px-6">
            
            {/* Header / Close button */}
            <div className="flex items-center justify-between border-b border-zinc-900 pb-4 mb-6">
              <Link
                href="/"
                onClick={closeAll}
                className="flex items-center gap-1 group"
              >
                <span className="text-lg font-bold font-sans tracking-tight text-white">seyon</span>
              </Link>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-full hover:bg-zinc-900 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Menu Links */}
            <nav className="flex-1 space-y-6">
              <div className="space-y-3">
                <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Browse</span>
                <Link
                  href="/marketplace"
                  onClick={closeAll}
                  className="flex items-center justify-between text-sm font-semibold text-zinc-300 hover:text-primary py-1 transition-colors"
                >
                  Marketplace Catalog
                  <ChevronRight className="h-4 w-4 text-zinc-500" />
                </Link>
                <Link
                  href={`${buyerMarketUrl}/wishlist`}
                  onClick={closeAll}
                  className="flex items-center justify-between text-sm font-semibold text-zinc-300 hover:text-primary py-1 transition-colors"
                >
                  My Wishlist
                  <ChevronRight className="h-4 w-4 text-zinc-500" />
                </Link>
              </div>

              <div className="space-y-3">
                <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Support</span>
                <a
                  href="mailto:support@seyon.com"
                  className="flex items-center justify-between text-sm font-semibold text-zinc-300 hover:text-primary py-1 transition-colors"
                >
                  Contact Support
                  <ChevronRight className="h-4 w-4 text-zinc-500" />
                </a>
                <Link
                  href="/privacy"
                  onClick={closeAll}
                  className="flex items-center justify-between text-sm font-semibold text-zinc-300 hover:text-primary py-1 transition-colors"
                >
                  Privacy Policy
                  <ChevronRight className="h-4 w-4 text-zinc-500" />
                </Link>
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
