'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { WishlistButton } from './wishlist-button';
import { NoImagePlaceholder } from './no-image-placeholder';

// Helper to convert Hex to HSL for dark mode computation
function hexToHSL(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;

  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: s * 100, l: l * 100 };
}

// Helper to convert HSL to Hex
function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) => Math.round(255 * x).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

const DEFAULT_THEME = {
  bg: '#F4F1EA',
  border: '#E7E2D8',
  tagBg: 'rgba(16, 185, 129, 0.05)',
  accent: '#065f46',
  glow: 'rgba(245, 158, 11, 0.05)',
  bgDark: '#18181b',
  borderDark: '#27272a',
  tagBgDark: 'rgba(16, 185, 129, 0.1)',
  accentDark: '#34d399',
  glowDark: 'rgba(245, 158, 11, 0.1)',
};

interface ProductCardProps {
  product: {
    id: string;
    title: string;
    slug: string;
    price: number;
    compareAtPrice?: number | null;
    category: string;
    inStock?: boolean;
    images: { url: string }[];
    shop: {
      name: string;
      slug: string;
      isVerified?: boolean;
    };
    themeBg?: string | null;
    themeSurface?: string | null;
    themeAccent?: string | null;
    themeAccentStrong?: string | null;
    themeText?: string | null;
    themeMuted?: string | null;
    themeExtractedAt?: Date | string | null;
  };
  initialIsWishlisted?: boolean;
  showWishlistButton?: boolean;
  buyerMarketUrl?: string;
}

const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    width="13"
    height="13"
    {...props}
  >
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.731-1.456L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.864-9.864.002-2.637-1.019-5.116-2.876-6.974S14.653 1.082 12.016 1.08c-5.438 0-9.87 4.42-9.874 9.865-.001 1.738.464 3.434 1.346 4.943L2.457 20.25l4.19-1.096z" />
  </svg>
);

export function ProductCard({
  product,
  initialIsWishlisted = false,
  showWishlistButton = true,
  buyerMarketUrl = '',
}: ProductCardProps) {
  const shopSlug = product.shop.slug;
  const productSlug = product.slug;
  const productUrl = `${buyerMarketUrl}/store/${shopSlug}/${productSlug}`;

  const isSoldOut = product.inStock === false;

  // Resolve palette values using useMemo to prevent unnecessary calculations
  const theme = React.useMemo(() => {
    if (!product.themeExtractedAt || !product.themeAccent) {
      return DEFAULT_THEME;
    }

    const { h, s } = hexToHSL(product.themeAccent);
    const sat = Math.max(s, 25);

    // Compute dark mode colors on the fly from the hue
    const bgDark = hslToHex(h, sat * 0.4, 10);
    const borderDark = hslToHex(h, sat * 0.45, 16);
    const tagBgDark = hslToHex(h, sat * 0.45, 14);
    const accentDark = hslToHex(h, Math.max(s, 40), 65);

    // Parse the stored accent to RGB for hover glow
    const hex = product.themeAccent;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    return {
      bg: product.themeBg || '#F4F1EA',
      border: product.themeMuted || '#E7E2D8',
      tagBg: product.themeSurface || 'rgba(16, 185, 129, 0.05)',
      accent: product.themeAccentStrong || '#065f46',
      glow: `rgba(${r}, ${g}, ${b}, 0.08)`,
      bgDark,
      borderDark,
      tagBgDark,
      accentDark,
      glowDark: `rgba(${r}, ${g}, ${b}, 0.18)`,
    };
  }, [product]);

  // CSS variables targeting theme or fallback defaults
  const dynamicVars = {
    '--card-bg': theme.bg,
    '--card-border': theme.border,
    '--card-tag-bg': theme.tagBg,
    '--card-accent': theme.accent,
    '--card-glow': theme.glow,
    '--card-bg-dark': theme.bgDark,
    '--card-border-dark': theme.borderDark,
    '--card-tag-bg-dark': theme.tagBgDark,
    '--card-accent-dark': theme.accentDark,
    '--card-glow-dark': theme.glowDark,
  } as React.CSSProperties;

  return (
    <div className="relative group h-full transition-all duration-500" style={dynamicVars}>
      {/* Background soft glow animation on hover */}
      <div className="absolute -inset-1 bg-gradient-to-tr from-[var(--card-glow)] to-[var(--card-glow)] rounded-[30px] blur-xl opacity-0 group-hover:opacity-100 dark:from-[var(--card-glow-dark)] dark:to-[var(--card-glow-dark)] transition-all duration-500 -z-10" />

      <Link
        href={productUrl}
        className="block h-full bg-[var(--card-bg)] dark:bg-[var(--card-bg-dark)] border border-[var(--card-border)] dark:border-[var(--card-border-dark)] rounded-[28px] overflow-hidden flex flex-col justify-between cursor-pointer shadow-sm hover:shadow-xl transition-all duration-500 ease-out hover:-translate-y-1"
      >
        {/* Top: Product Image with fade bottom */}
        <div className="relative aspect-[3/4] bg-zinc-100 dark:bg-zinc-950/20 overflow-hidden shrink-0">
          {product.images?.[0] ? (
            <Image
              src={product.images[0].url}
              alt={product.title}
              fill
              className={`object-cover ${isSoldOut ? 'opacity-60 grayscale-[40%]' : ''}`}
              sizes="(max-width: 768px) 50vw, 25vw"
            />
          ) : (
            <NoImagePlaceholder />
          )}

          {/* Premium Soft Gradient Bottom blending from image to card bg */}
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[var(--card-bg)] via-[var(--card-bg)]/50 to-transparent dark:from-[var(--card-bg-dark)] dark:via-[var(--card-bg-dark)]/50 transition-all duration-500 pointer-events-none" />

          {/* Wishlist Button Overlay */}
          {showWishlistButton && (
            <div className="absolute top-3 right-3 z-10">
              <WishlistButton
                productId={product.id}
                initialIsWishlisted={initialIsWishlisted}
              />
            </div>
          )}

          {/* Sold Out Badge */}
          {isSoldOut && (
            <span className="absolute top-3 left-3 z-10 px-2.5 py-0.5 rounded-full bg-zinc-900/80 text-white text-[10px] font-bold uppercase tracking-wide">
              Sold out
            </span>
          )}
        </div>

        {/* Bottom: Card content (Title, brand, price, CTAs) */}
        <div className="p-5 pt-2 flex flex-col justify-between flex-grow">
          <div>
            {/* Title & Brand */}
            <h3 className="font-bold text-zinc-900 dark:text-white text-base md:text-lg line-clamp-1 group-hover:text-[var(--card-accent)] dark:group-hover:text-[var(--card-accent-dark)] transition-colors">
              {product.title}
            </h3>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 block">
              by {product.shop.name}
            </span>

            {/* Short divider line matching the borders */}
            <div className="w-8 h-0.5 bg-[var(--card-border)] dark:bg-[var(--card-border-dark)] transition-all duration-500 mt-3 mb-2.5" />

            {/* Price */}
            <div className="flex items-baseline gap-1.5">
              <span className="font-extrabold text-zinc-900 dark:text-white text-lg">
                ₹{product.price.toFixed(2)}
              </span>
              {product.compareAtPrice != null && product.compareAtPrice > product.price && (
                <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500 line-through">
                  ₹{product.compareAtPrice.toFixed(2)}
                </span>
              )}
            </div>
          </div>

          {/* Badges/Actions at bottom */}
          <div className="mt-5 flex items-center justify-between border-t border-[var(--card-border)] dark:border-[var(--card-border-dark)] transition-all duration-500 pt-4 gap-2">
            {/* Category pill */}
            <span className="text-[10px] uppercase font-extrabold text-[var(--card-accent)] dark:text-[var(--card-accent-dark)] border border-[var(--card-border)] dark:border-[var(--card-border-dark)] bg-[var(--card-tag-bg)] dark:bg-[var(--card-tag-bg-dark)] px-3 py-1 rounded-full truncate max-w-[100px] sm:max-w-[120px] transition-all duration-500">
              {product.category}
            </span>

            {/* WhatsApp action */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-800 dark:border-zinc-300 text-zinc-800 dark:text-zinc-200 text-[10px] font-extrabold uppercase tracking-wider rounded-full bg-transparent group-hover:bg-zinc-800 group-hover:text-white dark:group-hover:bg-zinc-200 dark:group-hover:text-black transition-colors shrink-0">
              <WhatsAppIcon />
              WhatsApp
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}

export default ProductCard;
