import Link from 'next/link';
import Image from 'next/image';
import { auth, signIn, signOut } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Role } from '@prisma/client';
import { ShoppingBag, LayoutDashboard, ShieldAlert, LogOut } from 'lucide-react';

export async function Navbar() {
  const session = await auth();
  const user = session?.user;

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
          <Link href="/marketplace" className="text-sm font-medium text-zinc-300 hover:text-white transition-colors">
            Marketplace
          </Link>
          {user && (
            <Link href="/dashboard" className="text-sm font-medium text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5">
              <LayoutDashboard className="h-4 w-4" /> Seller Dashboard
            </Link>
          )}
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
              <form
                action={async () => {
                  'use server';
                  await signIn(undefined, { redirectTo: '/dashboard' });
                }}
              >
                <Button variant="ghost" size="sm" className="text-zinc-300 hover:text-white">
                  Log In
                </Button>
              </form>
              <Link href="/dashboard">
                <Button size="sm">
                  Sell Products
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
