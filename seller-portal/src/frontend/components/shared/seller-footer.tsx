import Link from 'next/link';
import { Briefcase } from 'lucide-react';
import { auth } from '@/lib/auth';

export async function SellerFooter() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <footer className="border-t border-zinc-800 bg-zinc-950 py-8 md:py-12 mt-auto text-zinc-400">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-black shadow-md">
              <Briefcase className="h-4 w-4" />
            </div>
            <span className="text-lg font-bold font-sans tracking-tight text-white flex items-center gap-1">
              seyon
              <span className="text-[10px] text-zinc-500 ml-1 font-sans tracking-normal">Sellers</span>
            </span>
          </div>
          
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-zinc-400">
            {!isLoggedIn && (
              <Link href="/sell" className="hover:text-white transition-colors">
                Seller Home
              </Link>
            )}
            <Link href="/dashboard" className="hover:text-white transition-colors">
              Dashboard
            </Link>
            {!isLoggedIn && (
              <Link href="/login" className="hover:text-white transition-colors">
                Login / Register
              </Link>
            )}
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms & Conditions
            </Link>
          </div>
          
          <p className="text-xs text-zinc-600">
            &copy; {new Date().getFullYear()} Seyon Sellers. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
export default SellerFooter;

