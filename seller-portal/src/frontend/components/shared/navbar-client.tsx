'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, Search, X, ShoppingBag, Heart, LogOut, ShieldCheck, ChevronRight } from 'lucide-react';

interface NavbarClientProps {
  user?: {
    name?: string | null;
    email?: string | null;
    role?: string;
  };
  wishlistCount: number;
  buyerMarketUrl: string;
  onSignOut: () => Promise<void>;
}

interface Suggestion {
  categories: { name: string; count: number }[];
  shops: { name: string; slug: string; logo: string | null }[];
  products: { id: string; title: string; slug: string; price: number; shopSlug: string }[];
}

export function NavbarClient({ user, wishlistCount, buyerMarketUrl, onSignOut }: NavbarClientProps) {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [suggestions, setSuggestions] = React.useState<Suggestion | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Focus search input when opened
  React.useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Fetch search suggestions
  React.useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions(null);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data);
        }
      } catch (err) {
        console.error('Failed to load suggestions:', err);
      } finally {
        setLoadingSuggestions(false);
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
      <header className="sticky top-0 z-40 w-full border-t border-b border-zinc-200 bg-white text-zinc-800 shadow-sm transition-colors duration-300">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 relative">
          
          {/* Left Side: Menu & Search */}
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              onClick={() => { setIsMenuOpen(true); setIsSearchOpen(false); }}
              className="flex items-center gap-1.5 text-zinc-900 hover:text-pink-600 transition-colors uppercase font-semibold text-[10px] sm:text-xs tracking-widest cursor-pointer"
            >
              <Menu className="h-4 w-4 stroke-[1.5]" />
              <span className="hidden xs:inline">Menu</span>
            </button>
            <button
              onClick={() => { setIsSearchOpen(prev => !prev); setIsMenuOpen(false); }}
              className="flex items-center gap-1.5 text-zinc-900 hover:text-pink-600 transition-colors uppercase font-semibold text-[10px] sm:text-xs tracking-widest cursor-pointer"
            >
              <Search className="h-4 w-4 stroke-[1.5]" />
              <span className="hidden xs:inline">Search</span>
            </button>
          </div>

          {/* Middle: Logo (centered) */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <Link
              href="/"
              className="text-xl sm:text-2xl font-bold font-sans tracking-tight text-zinc-900 flex items-center gap-0.5 group"
            >
              <span>seyon</span>
              <span className="inline-block w-1.5 h-1.5 bg-pink-500 rounded-sm group-hover:scale-125 transition-transform duration-300"></span>
            </Link>
          </div>

          {/* Right Side: Account, Wishlist, Bag */}
          <div className="flex items-center gap-4 sm:gap-6">
            <a
              href="mailto:support@seyon.com"
              className="relative text-zinc-900 hover:text-pink-600 transition-colors uppercase font-semibold text-[10px] sm:text-xs tracking-widest cursor-pointer group pb-0.5 hidden md:block"
            >
              Contact Us
              <span className="absolute bottom-0 left-0 w-full h-[1.5px] bg-pink-500 scale-x-100 origin-left transition-transform duration-350"></span>
            </a>
            
            <Link
              href={user ? "/dashboard" : "/login?callbackUrl=/dashboard"}
              className="text-zinc-900 hover:text-pink-600 transition-colors uppercase font-semibold text-[10px] sm:text-xs tracking-widest hidden sm:block"
            >
              My Account
            </Link>

            <Link
              href="/marketplace"
              className="text-zinc-900 hover:text-pink-600 transition-colors flex items-center justify-center"
              title="Browse Marketplace"
            >
              <ShoppingBag className="h-5 w-5 stroke-[1.5]" />
            </Link>

            <Link
              href={`${buyerMarketUrl}/wishlist`}
              className="relative p-0.5 text-zinc-900 hover:text-rose-500 transition-colors flex items-center justify-center"
              title="My Wishlist"
            >
              <Heart className="h-5 w-5 stroke-[1.5]" />
              {wishlistCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-pink-500 text-[9px] text-white font-extrabold rounded-full flex items-center justify-center">
                  {wishlistCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Slide-Down Search Panel */}
        {isSearchOpen && (
          <div className="border-t border-zinc-150 bg-white animate-slide-down shadow-md">
            <div className="container mx-auto px-4 py-4 sm:px-6">
              <form onSubmit={handleSearchSubmit} className="flex gap-3 items-center relative">
                <Search className="h-5 w-5 text-zinc-400 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search products, brands, categories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent border-0 outline-0 focus:ring-0 text-sm text-zinc-800 placeholder-zinc-400 py-1"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-zinc-400 hover:text-zinc-600 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded text-xs font-semibold uppercase tracking-wider transition-colors"
                >
                  Go
                </button>
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(false)}
                  className="text-zinc-500 hover:text-zinc-800 font-semibold p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </form>

              {/* Suggestions dropdown */}
              {suggestions && (
                <div className="mt-4 border border-zinc-100 rounded-lg bg-white shadow-xl max-h-[350px] overflow-y-auto divide-y divide-zinc-100 p-2 animate-fade-in z-50">
                  {/* Categories */}
                  {suggestions.categories.length > 0 && (
                    <div className="py-2 px-3">
                      <span className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider">Categories</span>
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        {suggestions.categories.map((cat) => (
                          <Link
                            key={cat.name}
                            href={`/marketplace?category=${encodeURIComponent(cat.name)}`}
                            onClick={closeAll}
                            className="text-xs bg-zinc-50 hover:bg-pink-50 border border-zinc-150 rounded-full px-2.5 py-1 text-zinc-700 hover:text-pink-600 transition-colors font-medium"
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
                      <span className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider">Storefronts</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1.5">
                        {suggestions.shops.map((shop) => (
                          <Link
                            key={shop.slug}
                            href={`/store/${shop.slug}`}
                            onClick={closeAll}
                            className="flex items-center gap-2.5 p-1.5 rounded-md hover:bg-zinc-50 transition-colors"
                          >
                            {shop.logo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={shop.logo} alt={shop.name} className="h-6 w-6 rounded-full object-cover border border-zinc-200" />
                            ) : (
                              <div className="h-6 w-6 rounded-full bg-zinc-150 flex items-center justify-center text-[10px] font-bold text-zinc-500">
                                {shop.name[0].toUpperCase()}
                              </div>
                            )}
                            <span className="text-xs font-semibold text-zinc-800 hover:text-pink-600 transition-colors">{shop.name}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Products */}
                  {suggestions.products.length > 0 && (
                    <div className="py-2 px-3">
                      <span className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider">Products</span>
                      <div className="space-y-1 mt-1.5">
                        {suggestions.products.map((prod) => (
                          <Link
                            key={prod.id}
                            href={`/store/${prod.shopSlug}/${prod.slug}`}
                            onClick={closeAll}
                            className="flex items-center justify-between text-xs p-2 rounded-md hover:bg-zinc-50 text-zinc-700 hover:text-pink-600 font-medium transition-colors"
                          >
                            <span>{prod.title}</span>
                            <span className="font-bold text-zinc-900">₹{prod.price.toFixed(2)}</span>
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
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 animate-fade-in"
            onClick={() => setIsMenuOpen(false)}
          />

          {/* Drawer Body */}
          <div className="relative flex w-full max-w-xs flex-col bg-white text-zinc-800 shadow-2xl animate-slide-right py-6 px-6">
            
            {/* Header / Close button */}
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4 mb-6">
              <Link
                href="/"
                onClick={closeAll}
                className="text-lg font-bold font-sans tracking-tight text-zinc-900 flex items-center gap-0.5"
              >
                <span>seyon</span>
                <span className="inline-block w-1.5 h-1.5 bg-pink-500 rounded-sm"></span>
              </Link>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="text-zinc-500 hover:text-zinc-800 p-1 rounded-full hover:bg-zinc-50 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Menu Links */}
            <nav className="flex-1 space-y-6">
              <div className="space-y-3">
                <span className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider">Browse</span>
                <Link
                  href="/marketplace"
                  onClick={closeAll}
                  className="flex items-center justify-between text-sm font-semibold text-zinc-800 hover:text-pink-600 py-1 transition-colors"
                >
                  Marketplace Catalog
                  <ChevronRight className="h-4 w-4 text-zinc-400" />
                </Link>
                <Link
                  href={`${buyerMarketUrl}/wishlist`}
                  onClick={closeAll}
                  className="flex items-center justify-between text-sm font-semibold text-zinc-800 hover:text-pink-600 py-1 transition-colors"
                >
                  My Wishlist
                  <ChevronRight className="h-4 w-4 text-zinc-400" />
                </Link>
              </div>

              <div className="space-y-3">
                <span className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider">For Sellers</span>
                <Link
                  href={user ? "/dashboard" : "/sell"}
                  onClick={closeAll}
                  className="flex items-center justify-between text-sm font-semibold text-zinc-800 hover:text-pink-600 py-1 transition-colors"
                >
                  {user ? "Seller Dashboard" : "Sell on Seyon"}
                  <ChevronRight className="h-4 w-4 text-zinc-400" />
                </Link>
              </div>

              <div className="space-y-3">
                <span className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider">Support</span>
                <a
                  href="mailto:support@seyon.com"
                  className="flex items-center justify-between text-sm font-semibold text-zinc-800 hover:text-pink-600 py-1 transition-colors"
                >
                  Contact Support
                  <ChevronRight className="h-4 w-4 text-zinc-400" />
                </a>
                <Link
                  href="/privacy"
                  onClick={closeAll}
                  className="flex items-center justify-between text-sm font-semibold text-zinc-800 hover:text-pink-600 py-1 transition-colors"
                >
                  Privacy Policy
                  <ChevronRight className="h-4 w-4 text-zinc-400" />
                </Link>
              </div>
            </nav>

            {/* Footer / Account Actions */}
            <div className="border-t border-zinc-100 pt-6 mt-auto">
              {user ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-pink-100 border border-pink-200 flex items-center justify-center font-bold text-pink-650">
                      {user.name ? user.name[0].toUpperCase() : 'U'}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-zinc-800 line-clamp-1">{user.name}</span>
                      <span className="text-[10px] text-zinc-400 capitalize">{user.role?.toLowerCase() || ''}</span>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      closeAll();
                      await onSignOut();
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-300 text-red-650 hover:text-red-700 rounded-md text-xs font-bold transition-colors cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Sign Out
                  </button>
                </div>
              ) : (
                <Link
                  href="/login?callbackUrl=/dashboard"
                  onClick={closeAll}
                  className="w-full inline-flex items-center justify-center px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-md text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  Log In
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
