import Link from 'next/link';
import Image from 'next/image';
import { auth, signOut } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Role } from '@prisma/client';
import { LayoutDashboard, ShieldAlert, LogOut, ShoppingBag } from 'lucide-react';

export async function SellerNavbar() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-secondary text-secondary-foreground shadow-sm transition-colors duration-300">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 relative">

        {/* Left Side: Navigation Links */}
        <nav className="flex items-center gap-4 sm:gap-6">
          <Link
            href="/sell"
            className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-zinc-300 hover:text-primary transition-colors"
          >
            Seller Home
          </Link>
          <Link
            href="/dashboard"
            className="hidden sm:flex text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-zinc-300 hover:text-primary transition-colors items-center gap-1.5"
          >
            <LayoutDashboard className="h-4 w-4 stroke-[1.5]" /> Dashboard
          </Link>
          <Link
            href="/dashboard/products"
            className="hidden md:flex text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-zinc-300 hover:text-primary transition-colors items-center gap-1.5"
          >
            <ShoppingBag className="h-4 w-4 stroke-[1.5]" /> Products
          </Link>
          {user && user.role && user.role === Role.ADMIN && (
            <Link
              href="/admin"
              className="hidden md:flex text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-zinc-300 hover:text-primary transition-colors items-center gap-1.5"
            >
              <ShieldAlert className="h-4 w-4 stroke-[1.5]" /> Moderation
            </Link>
          )}
        </nav>

        {/* Middle: Centered Logo */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <Link
            href="/sell"
            className="text-xl sm:text-2xl font-bold font-sans tracking-tight text-white flex items-center gap-0.5 group"
          >
            <span>seyon</span>
          </Link>
        </div>

        {/* Right Side: User Session Actions */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <Link href="/account" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
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
              </Link>

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
