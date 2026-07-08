import Link from 'next/link';

const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M21 11.5a8.3 8.3 0 0 1-8.3 8.3 8.3 8.3 0 0 1-4-.1L4 20.8l1.1-4.6a8.3 8.3 0 1 1 15.9-4.7z" />
    <path d="M15.4 14c-.2-.1-.9-.4-1.1-.5s-.3-.1-.4 0-.4.5-.5.6-.2.2-.4.1A5.3 5.3 0 0 1 10.3 12a4.8 4.8 0 0 1-1-1.3c-.1-.2 0-.3.1-.4s.2-.2.3-.3v-.3c0-.1-.1-.3-.3-.6s-.4-.5-.5-.5h-.3c-.1 0-.3.1-.4.2s-.5.5-.5 1.1.4 1.3.5 1.4c.1.1 1.7 2.6 4.1 3.6a13.3 13.3 0 0 0 1.4.5c.6.2 1.1.2 1.5.1s1-.4 1.1-1c.2-.5.2-1 0-1.1z" fill="currentColor" stroke="none" />
  </svg>
);

const TelegramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="M22 2 11 13" />
  </svg>
);

const YouTubeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" />
    <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="currentColor" />
  </svg>
);

export function Footer() {
  const buyerMarketUrl = process.env.BUYER_MARKET_URL || 'https://seyon-pied.vercel.app';
  return (
    <footer className="border-t border-zinc-800 bg-black py-8 md:py-12 mt-auto text-secondary-foreground">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Department links: internal link equity for the SEO category pages */}
        <nav aria-label="Shop by category" className="mb-8 pb-6 border-b border-zinc-800">
          <span className="text-[10px] uppercase font-bold text-[#A77F3A] tracking-wider block mb-3">SHOP BY CATEGORY</span>
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

        {/* 5-column grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-8">
          {/* Column 1: Brand */}
          <div className="col-span-2 md:col-span-1 space-y-4">
            <Link href="/" className="text-2xl font-bold tracking-tight text-white font-serif" style={{ fontFamily: 'Georgia, serif' }}>
              seyon
            </Link>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Social-commerce storefronts for independent sellers. Discover, browse, and buy direct.
            </p>
            {/* Follow Us Section */}
            <div className="space-y-3 pt-2">
              <span className="text-[10px] uppercase font-bold text-[#A77F3A] tracking-wider block">
                FOLLOW US
              </span>
              <div className="flex items-center gap-3">
                <a href="https://instagram.com/seyon.store" target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-full border border-[#A77F3A]/30 hover:border-[#A77F3A] hover:bg-[#A77F3A]/10 flex items-center justify-center text-white transition-all duration-300" aria-label="Instagram">
                  <InstagramIcon className="h-4.5 w-4.5" />
                </a>
                <a href="https://wa.me/919876543210" target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-full border border-[#A77F3A]/30 hover:border-[#A77F3A] hover:bg-[#A77F3A]/10 flex items-center justify-center text-white transition-all duration-300" aria-label="WhatsApp">
                  <WhatsAppIcon className="h-4.5 w-4.5" />
                </a>
                <a href="https://t.me/seyon" target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-full border border-[#A77F3A]/30 hover:border-[#A77F3A] hover:bg-[#A77F3A]/10 flex items-center justify-center text-white transition-all duration-300" aria-label="Telegram">
                  <TelegramIcon className="h-4.5 w-4.5" />
                </a>
                <a href="https://youtube.com/@seyon" target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-full border border-[#A77F3A]/30 hover:border-[#A77F3A] hover:bg-[#A77F3A]/10 flex items-center justify-center text-white transition-all duration-300" aria-label="YouTube">
                  <YouTubeIcon className="h-4.5 w-4.5" />
                </a>
              </div>
            </div>
          </div>

          {/* Column 2: Explore */}
          <div className="space-y-3">
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">Explore</span>
            <ul className="space-y-2 text-sm text-zinc-400">
              <li>
                <Link href="/category" className="hover:text-white transition-colors">Categories</Link>
              </li>
              <li>
                <Link href="/wishlist" className="hover:text-white transition-colors">Wishlist</Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Sell on Seyon */}
          <div className="space-y-3">
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">Sell on Seyon</span>
            <ul className="space-y-2 text-sm text-zinc-400">
              <li>
                <Link href="/sell" className="hover:text-white transition-colors">Sellers Home</Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-white transition-colors">Seller Dashboard</Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Support */}
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
            &copy; {new Date().getFullYear()} Seyon. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
export default Footer;
