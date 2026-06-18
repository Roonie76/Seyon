import Link from 'next/link';

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

export function Footer() {
  const buyerMarketUrl = process.env.BUYER_MARKET_URL || 'https://seyon-pied.vercel.app';
  return (
    <footer className="border-t border-zinc-800 bg-secondary py-8 md:py-12 mt-auto text-secondary-foreground">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Department links: internal link equity for the SEO category pages */}
        <nav aria-label="Shop by category" className="mb-8 pb-6 border-b border-zinc-800">
          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block mb-3">Shop by Category</span>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-zinc-400">
            {['Fashion', 'Electronics', 'Beauty', 'Home & Living', 'Clay Crafts', 'DIY Crafts', 'Art & Collectibles', 'Food & Beverages'].map((cat) => (
              <Link
                key={cat}
                href={`${buyerMarketUrl}/category/${encodeURIComponent(cat.toLowerCase())}`}
                className="hover:text-white transition-colors"
              >
                {cat}
              </Link>
            ))}
          </div>
        </nav>
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo — matches navbar style */}
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold font-sans tracking-tight text-white">
              seyon
            </Link>
            {/* Social links */}
            <div className="flex items-center gap-3">
              <a href="https://instagram.com/seyon.store" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-pink-500 transition-colors" aria-label="Instagram">
                <InstagramIcon />
              </a>
              <a href="https://x.com/seyonstore" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-white transition-colors" aria-label="X (Twitter)">
                <XIcon />
              </a>
              <a href="https://linkedin.com/company/seyon" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-sky-500 transition-colors" aria-label="LinkedIn">
                <LinkedInIcon />
              </a>
            </div>
          </div>
          
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-zinc-400">
            <Link href="/" className="hover:text-white transition-colors">
              Home
            </Link>
            <Link href="/marketplace" className="hover:text-white transition-colors">
              Marketplace
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
