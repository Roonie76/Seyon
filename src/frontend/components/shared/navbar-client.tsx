'use client';

import { LEGAL_CONTACTS } from '@/shared/data/legal-entity';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, Search, X, Heart, ChevronRight, User, LogOut, ShoppingCart } from 'lucide-react';
import { getTotalCartCount } from '@/frontend/lib/cart-utils';

interface NavbarClientProps {
  user?: {
    name?: string | null;
    email?: string | null;
    role?: string;
    image?: string | null;
  };
  wishlistCount: number;
  buyerMarketUrl: string;
  onSignOut: () => Promise<void>;
}

interface Suggestion {
  categories: string[];
  shops: { name: string; slug: string; logo: string | null }[];
  products: { id: string; title: string; slug: string; price: number; shop: { slug: string } }[];
}

export function NavbarClient({ user, wishlistCount, onSignOut }: NavbarClientProps) {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [suggestions, setSuggestions] = React.useState<Suggestion | null>(null);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [cartCount, setCartCount] = React.useState(() => {
    if (typeof window !== 'undefined') {
      return getTotalCartCount();
    }
    return 0;
  });

  // Sync cart count
  React.useEffect(() => {
    const handleCartUpdated = () => {
      setCartCount(getTotalCartCount());
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key?.startsWith('seyon_cart:') || e.key === 'seyon_cart_meta') {
        setCartCount(getTotalCartCount());
      }
    };

    window.addEventListener('seyon-cart-updated', handleCartUpdated);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('seyon-cart-updated', handleCartUpdated);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Fetch search suggestions
  React.useEffect(() => {
    if (!searchQuery.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestions(null);
      return;
    }

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
      router.push(`/?q=${encodeURIComponent(searchQuery.trim())}`);
      setSuggestions(null);
      setIsMobileSearchOpen(false);
    }
  };

  const closeAll = () => {
    setIsMenuOpen(false);
    setSearchQuery('');
    setSuggestions(null);
    setIsMobileSearchOpen(false);
  };

  return (
    <>
      {/* Header element */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white text-zinc-900 shadow-sm transition-colors duration-300">
        <div className="container mx-auto px-4 sm:px-6 py-3 md:py-4">
          
          {/* Main row */}
          <div className="flex items-center justify-between gap-4 md:gap-8">
            
            {/* Left: Logo & Hamburger (Mobile) */}
            <div className="flex items-center gap-3">
              {/* Hamburger Menu Trigger (Mobile only) */}
              <button
                onClick={() => setIsMenuOpen(true)}
                className="md:hidden p-1 text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer"
                aria-label="Open menu"
              >
                <Menu className="h-6 w-6 stroke-[1.5]" />
              </button>

              {/* Serif elegant Logo */}
              <Link
                href="/"
                onClick={closeAll}
                className="text-2xl font-bold tracking-tight text-zinc-900 flex items-center group font-serif"
                style={{ fontFamily: 'Georgia, serif' }}
              >
                seyon
              </Link>
            </div>

            {/* Center: Inline search bar (Desktop & tablet) */}
            <div className="hidden md:block flex-1 max-w-md lg:max-w-lg relative">
              <form onSubmit={handleSearchSubmit} className="relative flex items-center w-full bg-white border border-zinc-200 focus-within:border-[#A77F3A] focus-within:ring-2 focus-within:ring-[#A77F3A]/10 rounded-full px-4 py-1.5 transition-all">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search products, creators, stores..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent border-0 outline-0 focus:ring-0 text-xs sm:text-sm text-zinc-900 placeholder-zinc-400 pr-12"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(''); setSuggestions(null); }}
                    className="absolute right-12 text-zinc-400 hover:text-zinc-600 transition-colors p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="submit"
                  className="absolute right-1 w-8 h-8 bg-[#A77F3A] hover:bg-[#916b2f] text-white rounded-full flex items-center justify-center transition-colors shadow-sm cursor-pointer"
                >
                  <Search className="h-3.5 w-3.5 stroke-[2.5] text-white" />
                </button>
              </form>

              {/* Suggestions Dropdown (Desktop) */}
              {suggestions && (
                <div className="absolute top-full left-0 right-0 mt-2 border border-zinc-200 rounded-xl bg-white shadow-xl max-h-[350px] overflow-y-auto divide-y divide-zinc-100 p-2 animate-fade-in z-50">
                  {/* Categories */}
                  {suggestions.categories.length > 0 && (
                    <div className="py-2 px-3">
                      <span className="text-[11px] uppercase font-bold text-zinc-400 tracking-wider">Categories</span>
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        {suggestions.categories.map((cat) => (
                          <Link
                            key={cat}
                            href={`/?category=${encodeURIComponent(cat)}`}
                            onClick={closeAll}
                            className="text-xs bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-full px-2.5 py-1 text-zinc-700 hover:text-[#D4AF37] transition-colors font-medium"
                          >
                            {cat}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Shops */}
                  {suggestions.shops.length > 0 && (
                    <div className="py-2 px-3">
                      <span className="text-[11px] uppercase font-bold text-zinc-400 tracking-wider">Creators</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1.5">
                        {suggestions.shops.map((shop) => (
                          <Link
                            key={shop.slug}
                            href={`/store/${shop.slug}`}
                            onClick={closeAll}
                            className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-zinc-50 transition-colors"
                          >
                            {shop.logo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={shop.logo} alt={shop.name} className="h-6 w-6 rounded-full object-cover border border-zinc-200" />
                            ) : (
                              <div className="h-6 w-6 rounded-full bg-zinc-200 flex items-center justify-center text-[11px] font-bold text-zinc-600">
                                {shop.name[0].toUpperCase()}
                              </div>
                            )}
                            <span className="text-xs font-semibold text-zinc-700 hover:text-[#D4AF37] transition-colors">{shop.name}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Products */}
                  {suggestions.products.length > 0 && (
                    <div className="py-2 px-3">
                      <span className="text-[11px] uppercase font-bold text-zinc-400 tracking-wider">Products</span>
                      <div className="space-y-1 mt-1.5">
                        {suggestions.products.map((prod) => (
                          <Link
                            key={prod.id}
                            href={`/store/${prod.shop.slug}/${prod.slug}`}
                            onClick={closeAll}
                            className="flex items-center justify-between text-xs p-2 rounded-lg hover:bg-zinc-50 text-zinc-700 hover:text-[#D4AF37] font-medium transition-colors"
                          >
                            <span>{prod.title}</span>
                            <span className="font-bold text-zinc-950">₹{prod.price}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: Navigation Links & Icons */}
            <div className="flex items-center gap-4 lg:gap-6">
              {/* Icons row */}
              <div className="flex items-center gap-4">
                {/* Search Toggle (Mobile only) */}
                <button
                  onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
                  className="md:hidden p-1.5 text-zinc-650 hover:text-[#A77F3A] transition-colors cursor-pointer"
                  title="Search"
                >
                  <Search className="h-5 w-5 stroke-[1.5]" />
                </button>

                {/* Wishlist */}
                <Link
                  href="/wishlist"
                  className="relative p-1 text-zinc-600 hover:text-rose-500 transition-colors flex items-center justify-center"
                  title="My Wishlist"
                >
                  <Heart className="h-5 w-5 stroke-[1.5]" />
                  {wishlistCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-rose-500 text-[11px] text-white font-extrabold rounded-full flex items-center justify-center">
                      {wishlistCount}
                    </span>
                  )}
                </Link>

                {/* Cart */}
                <Link
                  href="/cart"
                  className="relative p-1 text-zinc-600 hover:text-amber-500 transition-colors flex items-center justify-center"
                  title="My Cart"
                >
                  <ShoppingCart className="h-5 w-5 stroke-[1.5]" />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-amber-500 text-[11px] text-white font-extrabold rounded-full flex items-center justify-center animate-fade-in">
                      {cartCount > 99 ? '99+' : cartCount}
                    </span>
                  )}
                </Link>


                {/* Account */}
                {user ? (
                  <Link
                    href="/account"
                    className="h-8 w-8 rounded-full border border-zinc-200 overflow-hidden flex items-center justify-center hover:border-[#A77F3A]/50 transition-all shadow-2xs cursor-pointer"
                    title="My Account"
                  >
                    {user.image ? (
                      <img src={user.image} alt={user.name || 'User'} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-[#FAF8F5] flex items-center justify-center text-xs font-bold text-[#A77F3A] font-serif">
                        {user.name ? user.name[0].toUpperCase() : 'U'}
                      </div>
                    )}
                  </Link>
                ) : (
                  <Link
                    href="/login"
                    className="h-8 w-8 rounded-full bg-zinc-50 border border-zinc-200 flex items-center justify-center text-zinc-500 hover:text-[#A77F3A] hover:border-[#A77F3A]/50 transition-all shadow-2xs cursor-pointer"
                    title="Login or Sign Up"
                  >
                    <User className="h-4.5 w-4.5 stroke-[1.5]" />
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Mobile search bar (Visible under the header row on mobile only when toggled) */}
          {isMobileSearchOpen && (
            <div className="md:hidden mt-3 relative animate-fade-in">
              <form onSubmit={handleSearchSubmit} className="relative flex items-center w-full bg-white border border-zinc-200 focus-within:border-[#A77F3A] rounded-full px-4 py-1.5">
                <input
                  type="text"
                  placeholder="Search products, creators, stores..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent border-0 outline-0 focus:ring-0 text-xs text-zinc-900 placeholder-zinc-400 pr-12"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(''); setSuggestions(null); }}
                    className="absolute right-12 text-zinc-400 hover:text-zinc-600 transition-colors p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="submit"
                  className="absolute right-1 w-7 h-7 bg-[#A77F3A] text-white rounded-full flex items-center justify-center"
                >
                  <Search className="h-3 w-3 stroke-[2.5]" />
                </button>
              </form>

            {/* Suggestions Dropdown (Mobile) */}
            {suggestions && (
              <div className="absolute top-full left-0 right-0 mt-2 border border-zinc-200 rounded-xl bg-white shadow-xl max-h-[300px] overflow-y-auto divide-y divide-zinc-100 p-2 animate-fade-in z-50">
                {/* Categories */}
                {suggestions.categories.length > 0 && (
                  <div className="py-2 px-2">
                    <span className="text-[11px] uppercase font-bold text-zinc-400 tracking-wider">Categories</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {suggestions.categories.map((cat) => (
                        <Link
                          key={cat}
                          href={`/?category=${encodeURIComponent(cat)}`}
                          onClick={closeAll}
                          className="text-[11px] bg-zinc-100 rounded-full px-2 py-0.5 text-zinc-700"
                        >
                          {cat}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Creators */}
                {suggestions.shops.length > 0 && (
                  <div className="py-2 px-2">
                    <span className="text-[11px] uppercase font-bold text-zinc-400 tracking-wider">Creators</span>
                    <div className="space-y-1.5 mt-1">
                      {suggestions.shops.map((shop) => (
                        <Link
                          key={shop.slug}
                          href={`/store/${shop.slug}`}
                          onClick={closeAll}
                          className="flex items-center gap-2 p-1 rounded hover:bg-zinc-50"
                        >
                          {shop.logo ? (
                            <img src={shop.logo} alt={shop.name} className="h-5 w-5 rounded-full object-cover" />
                          ) : (
                            <div className="h-5 w-5 rounded-full bg-zinc-200 flex items-center justify-center text-[11px] font-bold text-zinc-600">
                              {shop.name[0]}
                            </div>
                          )}
                          <span className="text-xs text-zinc-750">{shop.name}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Products */}
                {suggestions.products.length > 0 && (
                  <div className="py-2 px-2">
                    <span className="text-[11px] uppercase font-bold text-zinc-400 tracking-wider">Products</span>
                    <div className="space-y-1 mt-1">
                      {suggestions.products.map((prod) => (
                        <Link
                          key={prod.id}
                          href={`/store/${prod.shop.slug}/${prod.slug}`}
                          onClick={closeAll}
                          className="flex items-center justify-between text-xs p-1 rounded hover:bg-zinc-50 text-zinc-750"
                        >
                          <span>{prod.title}</span>
                          <span className="font-bold">₹{prod.price}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            </div>
          )}

        </div>
      </header>

      {/* Menu Drawer Drawer overlay (Mobile drawer in white theme) */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 animate-fade-in"
            onClick={() => setIsMenuOpen(false)}
            onKeyDown={(e) => { if (e.key === 'Escape') setIsMenuOpen(false); }}
            role="button"
            tabIndex={-1}
            aria-label="Close menu"
          />

          {/* Drawer Body */}
          <div className="relative flex w-full max-w-xs flex-col bg-white text-zinc-800 shadow-2xl border-r border-zinc-100 animate-slide-right py-6 px-6">
            
            {/* Header / Close button */}
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4 mb-6">
              <Link
                href="/"
                onClick={closeAll}
                className="flex items-center gap-1 group font-serif text-xl font-bold text-zinc-900"
              >
                seyon
              </Link>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="text-zinc-400 hover:text-zinc-950 p-1 rounded-full hover:bg-zinc-55 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Menu Links */}
            <nav className="flex-1 space-y-6">
              <div className="space-y-3">
                <Link
                  href="/wishlist"
                  onClick={closeAll}
                  className="flex items-center justify-between text-sm font-semibold text-zinc-700 hover:text-[#D4AF37] py-1 transition-colors"
                >
                  My Wishlist
                  <ChevronRight className="h-4 w-4 text-zinc-400" />
                </Link>
                <Link
                  href="/cart"
                  onClick={closeAll}
                  className="flex items-center justify-between text-sm font-semibold text-zinc-700 hover:text-[#D4AF37] py-1 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    My Basket
                    {cartCount > 0 && (
                      <span className="bg-amber-500 text-[11px] text-white px-2 py-0.5 rounded-full font-extrabold">
                        {cartCount}
                      </span>
                    )}
                  </span>
                  <ChevronRight className="h-4 w-4 text-zinc-400" />
                </Link>
              </div>

              <div className="space-y-3">
                <span className="text-[11px] uppercase font-bold text-zinc-400 tracking-wider">Support</span>
                <a
                  href={`mailto:${LEGAL_CONTACTS.support}`}
                  className="flex items-center justify-between text-sm font-semibold text-zinc-700 hover:text-[#D4AF37] py-1 transition-colors"
                >
                  Contact Support
                  <ChevronRight className="h-4 w-4 text-zinc-400" />
                </a>
                <Link
                  href="/privacy"
                  onClick={closeAll}
                  className="flex items-center justify-between text-sm font-semibold text-zinc-700 hover:text-[#D4AF37] py-1 transition-colors"
                >
                  Privacy Policy
                  <ChevronRight className="h-4 w-4 text-zinc-400" />
                </Link>
              </div>
            </nav>

            {/* Auth / Account Panel */}
            {user ? (
              <div className="border-t border-zinc-100 pt-6 mt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-zinc-100 border border-zinc-200 overflow-hidden flex items-center justify-center">
                    {user.image ? (
                      <img src={user.image} alt={user.name || 'User'} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-[#D4AF37]">
                        {user.name ? user.name[0].toUpperCase() : 'U'}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-zinc-800">{user.name}</span>
                    <span className="text-[11px] text-zinc-450 capitalize">{user.role?.toLowerCase() || ''}</span>
                  </div>
                </div>
                <Link
                  href="/account"
                  onClick={closeAll}
                  className="flex items-center justify-between text-sm font-semibold text-zinc-700 hover:text-[#D4AF37] py-1 transition-colors"
                >
                  My Account Settings
                  <ChevronRight className="h-4 w-4 text-zinc-400" />
                </Link>
                <button
                  onClick={async () => {
                    closeAll();
                    await onSignOut();
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-zinc-200 hover:border-red-500 bg-white hover:bg-red-50 text-zinc-600 hover:text-red-500 text-xs font-bold uppercase tracking-wider py-2.5 transition-colors cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Log Out
                </button>
              </div>
            ) : (
              <div className="border-t border-zinc-100 pt-6 mt-6">
                <Link
                  href="/login"
                  onClick={closeAll}
                  className="w-full flex items-center justify-center rounded-lg bg-[#D4AF37] hover:bg-[#B8962D] text-black text-xs font-bold uppercase tracking-wider py-2.5 transition-colors cursor-pointer"
                >
                  Login / Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
