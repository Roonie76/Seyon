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
    <footer className="border-t border-zinc-800 bg-zinc-950 py-8 md:py-12 mt-auto text-zinc-400">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo — matches seller navbar style */}
          <div className="flex items-center gap-4">
            <Link href="/sell" className="text-lg font-bold font-sans tracking-tight text-white flex items-center gap-1">
              seyon
              <span className="text-[10px] text-zinc-500 ml-1 font-sans tracking-normal">Sellers</span>
            </Link>
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
