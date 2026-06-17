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
    <header className="sticky top-0 z-40 w-full border-t border-b border-zinc-200 bg-white text-zinc-800 shadow-sm transition-colors duration-300">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/sell" className="flex items-center gap-1 group">
          <span className="text-xl font-bold font-sans tracking-tight text-zinc-900">seyon</span>
          <span className="inline-block w-1.5 h-1.5 bg-pink-500 rounded-sm group-hover:scale-125 transition-transform duration-300"></span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 ml-2 px-1.5 py-0.5 rounded border border-zinc-200 bg-zinc-50">
            Sellers
          </span>
        </Link>
 
        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <Link
            href="/sell"
            className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-zinc-800 hover:text-pink-600 transition-colors"
          >
            Seller Home
          </Link>
          <Link
            href="/dashboard"
            className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-zinc-800 hover:text-pink-600 transition-colors flex items-center gap-1.5"
          >
            <LayoutDashboard className="h-4 w-4 stroke-[1.5]" /> Dashboard
          </Link>
          <Link
            href="/dashboard/products"
            className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-zinc-800 hover:text-pink-600 transition-colors flex items-center gap-1.5"
          >
            <ShoppingBag className="h-4 w-4 stroke-[1.5]" /> Products
          </Link>
          {user && user.role && user.role === Role.ADMIN && (
            <Link
              href="/admin"
              className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-zinc-800 hover:text-pink-600 transition-colors flex items-center gap-1.5"
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
                <span className="text-xs font-bold text-zinc-800">{user.name}</span>
                <span className="text-[10px] text-zinc-400 capitalize">{user.role?.toLowerCase() || ''}</span>
              </div>
              <div className="h-8 w-8 rounded-full bg-zinc-50 border border-zinc-200 overflow-hidden flex items-center justify-center">
                {user.image ? (
                  <Image src={user.image} alt={user.name || 'User'} width={32} height={32} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-pink-600">
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
                <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-red-500 hover:bg-zinc-50 cursor-pointer" title="Sign Out">
                  <LogOut className="h-4 w-4" />
                </Button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login?callbackUrl=/dashboard">
                <Button variant="ghost" size="sm" className="text-zinc-650 hover:text-zinc-900 text-xs font-semibold uppercase tracking-wider">
                  Log In
                </Button>
              </Link>
              <Link href="/login?callbackUrl=/dashboard">
                <Button size="sm" className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold uppercase tracking-wider px-4">
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
