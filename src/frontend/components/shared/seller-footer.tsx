import Link from 'next/link';
import { auth } from '@/lib/auth';

const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

const XIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const LinkedInIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

export async function SellerFooter() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <footer className="border-t border-zinc-800 bg-black py-8 md:py-12 mt-auto text-zinc-400">
      <div className="container mx-auto px-4 sm:px-6">
        {/* 3-column grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-8">
          {/* Column 1: Brand */}
          <div className="col-span-2 md:col-span-1 space-y-4">
            <Link href="/sell" className="text-lg font-bold font-sans tracking-tight text-white flex items-center gap-1">
              seyon
              <span className="text-[10px] text-zinc-500 ml-1 font-sans tracking-normal">Sellers</span>
            </Link>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Your selling dashboard. Manage products, track performance, and grow your storefront.
            </p>
            {/* Social links */}
            <div className="flex items-center gap-3">
              <a href="https://instagram.com/seyon.store" target="_blank" rel="noopener noreferrer" className="text-zinc-600 hover:text-pink-500 transition-colors" aria-label="Instagram">
                <InstagramIcon />
              </a>
              <a href="https://x.com/seyonstore" target="_blank" rel="noopener noreferrer" className="text-zinc-600 hover:text-white transition-colors" aria-label="X (Twitter)">
                <XIcon />
              </a>
              <a href="https://linkedin.com/company/seyon" target="_blank" rel="noopener noreferrer" className="text-zinc-600 hover:text-sky-500 transition-colors" aria-label="LinkedIn">
                <LinkedInIcon />
              </a>
            </div>
          </div>

          {/* Column 2: Seller Tools */}
          <div className="space-y-3">
            <span className="text-[10px] uppercase font-bold text-zinc-600 tracking-wider block">Seller Tools</span>
            <ul className="space-y-2 text-sm text-zinc-400">
              <li>
                <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
              </li>
              <li>
                <Link href="/dashboard/products" className="hover:text-white transition-colors">My Products</Link>
              </li>
              {!isLoggedIn && (
                <>
                  <li>
                    <Link href="/sell" className="hover:text-white transition-colors">Sell on Seyon</Link>
                  </li>
                  <li>
                    <Link href="/login" className="hover:text-white transition-colors">Login / Register</Link>
                  </li>
                </>
              )}
            </ul>
          </div>

          {/* Column 3: Support & Legal */}
          <div className="space-y-3">
            <span className="text-[10px] uppercase font-bold text-zinc-600 tracking-wider block">Support & Legal</span>
            <ul className="space-y-2 text-sm text-zinc-400">
              <li>
                <Link href="/faqs" className="hover:text-white transition-colors">FAQs</Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white transition-colors">Contact Us</Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-white transition-colors">About</Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white transition-colors">Terms & Conditions</Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="pt-6 border-t border-zinc-800">
          <p className="text-xs text-zinc-600 text-center">
            &copy; {new Date().getFullYear()} Seyon Sellers. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
export default SellerFooter;
