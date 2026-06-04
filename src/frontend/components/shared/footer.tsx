import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-zinc-800 bg-secondary py-8 md:py-12 mt-auto text-secondary-foreground">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-black shadow-md">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <span className="text-lg font-black text-white tracking-wide">
              Seyon<span className="text-primary font-bold">.</span>
            </span>
          </div>
          
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-zinc-400">
            <Link href="/" className="hover:text-white transition-colors">
              Home
            </Link>
            <Link href="/marketplace" className="hover:text-white transition-colors">
              Marketplace
            </Link>
            <Link href="/dashboard" className="hover:text-white transition-colors">
              Register Shop
            </Link>
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms of Service
            </Link>
          </div>
          
          <p className="text-xs text-zinc-500">
            &copy; {new Date().getFullYear()} Seyon. Built with premium tech for instant storefronts.
          </p>
        </div>
      </div>
    </footer>
  );
}
export default Footer;
