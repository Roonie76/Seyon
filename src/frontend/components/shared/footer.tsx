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
    <footer className="border-t border-zinc-800 bg-black py-8 md:py-12 mt-auto text-secondary-foreground">
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

        {/* 4-column grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {/* Column 1: Brand */}
          <div className="col-span-2 md:col-span-1 space-y-4">
            <Link href="/" className="text-xl font-bold font-sans tracking-tight text-white">
              seyon
            </Link>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Social-commerce storefronts for independent sellers. Discover, browse, and buy direct.
            </p>
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

          {/* Column 2: Explore */}
          <div className="space-y-3">
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">Explore</span>
            <ul className="space-y-2 text-sm text-zinc-400">
              <li>
                <Link href="/marketplace" className="hover:text-white transition-colors">Marketplace</Link>
              </li>
              <li>
                <Link href="/category" className="hover:text-white transition-colors">Categories</Link>
              </li>
              <li>
                <Link href="/wishlist" className="hover:text-white transition-colors">Wishlist</Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Support */}
          <div className="space-y-3">
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">Support</span>
            <ul className="space-y-2 text-sm text-zinc-400">
              <li>
                <Link href="/faqs" className="hover:text-white transition-colors">FAQs</Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white transition-colors">Contact Us</Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Company */}
          <div className="space-y-3">
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">Company</span>
            <ul className="space-y-2 text-sm text-zinc-400">
              <li>
                <Link href="/about" className="hover:text-white transition-colors">About</Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
              </li>
              <li>
                <Link href="/address" className="hover:text-white transition-colors">Company Address</Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="pt-6 border-t border-zinc-800">
          <p className="text-xs text-zinc-500 text-center">
            &copy; {new Date().getFullYear()} Seyon. Built with premium tech for instant storefronts.
          </p>
        </div>
      </div>
    </footer>
  );
}
export default Footer;
