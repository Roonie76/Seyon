import Link from 'next/link';
import Image from 'next/image';
import { auth, signOut } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Role } from '@prisma/client';
import { LayoutDashboard, ShieldAlert, LogOut, ShoppingBag, Briefcase } from 'lucide-react';

export async function SellerNavbar() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-secondary text-secondary-foreground shadow-sm transition-colors duration-300">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/sell" className="flex items-center gap-2 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-black shadow-md group-hover:scale-105 transition-transform">
            <Briefcase className="h-5 w-5" />
          </div>
          <span className="text-xl sm:text-2xl font-bold font-sans tracking-tight text-white flex items-center gap-1.5">
            seyon
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900/50 font-sans tracking-normal">
              Sellers
            </span>
          </span>
        </Link>
 
        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <Link
            href="/sell"
            className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-zinc-300 hover:text-primary transition-colors"
          >
            Seller Home
          </Link>
          <Link
            href="/dashboard"
            className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-zinc-300 hover:text-primary transition-colors flex items-center gap-1.5"
          >
            <LayoutDashboard className="h-4 w-4 stroke-[1.5]" /> Dashboard
          </Link>
          <Link
            href="/dashboard/products"
            className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-zinc-300 hover:text-primary transition-colors flex items-center gap-1.5"
          >
            <ShoppingBag className="h-4 w-4 stroke-[1.5]" /> Products
          </Link>
          {user && user.role && user.role === Role.ADMIN && (
            <Link
              href="/admin"
              className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-zinc-300 hover:text-primary transition-colors flex items-center gap-1.5"
            >
              <ShieldAlert className="h-4 w-4 stroke-[1.5]" /> Moderation
            </Link>
          )}
        </nav>
 
        {/* User Session Actions */}
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-bold text-zinc-200">{user.name}</span>
                <span className="text-[10px] text-zinc-400 capitalize">{user.role?.toLowerCase() || ''}</span>
              </div>
              <div className="h-8 w-8 rounded-full bg-zinc-850 border border-zinc-750 overflow-hidden flex items-center justify-center">
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
                  await signOut({ redirectTo: '/sell' });
                }}
              >
                <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-red-400 hover:bg-zinc-800 cursor-pointer" title="Sign Out">
                  <LogOut className="h-4 w-4" />
                </Button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login?callbackUrl=/dashboard">
                <Button variant="ghost" size="sm" className="text-zinc-300 hover:text-white text-xs font-semibold uppercase tracking-wider">
                  Log In
                </Button>
              </Link>
              <Link href="/login?callbackUrl=/dashboard">
                <Button size="sm" className="bg-primary hover:bg-primary/90 text-black text-xs font-semibold uppercase tracking-wider px-4">
                  Register
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default SellerNavbar;
