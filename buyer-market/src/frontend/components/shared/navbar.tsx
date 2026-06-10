import Link from 'next/link';
import Image from 'next/image';
import { auth, signOut } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Role } from '@prisma/client';
import { ShoppingBag, ShieldAlert, LogOut, Heart } from 'lucide-react';
import { getWishlistCount } from '@/actions/wishlist';

export async function Navbar() {
  const buyerMarketUrl = process.env.BUYER_MARKET_URL || 'https://seyon-pied.vercel.app';
  const session = await auth();
  const user = session?.user;
  const wishlistCount = user ? await getWishlistCount() : 0;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-secondary text-secondary-foreground shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-black shadow-md group-hover:scale-105 transition-transform">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <span className="text-xl font-black text-white tracking-wide">
            Seyon<span className="text-primary font-bold">.</span>
          </span>
        </Link>
 
        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          {user && user.role && user.role === Role.ADMIN && (
            <Link href="/admin" className="text-sm font-medium text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4" /> Moderation
            </Link>
          )}
        </nav>
 
        {/* User Session Actions */}
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <Link href={`${buyerMarketUrl}/wishlist`} className="relative p-1.5 text-zinc-300 hover:text-rose-500 transition-colors flex items-center justify-center" title="My Wishlist">
                <Heart className="h-5 w-5" />
                {wishlistCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-rose-500 text-[9px] text-white font-extrabold rounded-full flex items-center justify-center">
                    {wishlistCount}
                  </span>
                )}
              </Link>
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold text-white">{user.name}</span>
                <span className="text-[10px] text-zinc-400 capitalize">{user.role?.toLowerCase() || ''}</span>
              </div>
              <div className="h-8 w-8 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center">
                {user.image ? (
                  <Image src={user.image} alt={user.name || 'User'} width={32} height={32} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-primary">
                    {user.name ? user.name[0].toUpperCase() : 'U'}
                  </span>
                )}
              </div>
              
              {/* Sign Out Form (NextAuth Action) */}
              <form
                action={async () => {
                  'use server';
                  await signOut({ redirectTo: '/' });
                }}
              >
                <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-red-400" title="Sign Out">
                  <LogOut className="h-4 w-4" />
                </Button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login?callbackUrl=/dashboard">
                <Button variant="ghost" size="sm" className="text-zinc-300 hover:text-white">
                  Log In
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
export default Navbar;
