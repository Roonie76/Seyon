'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { WishlistButton } from './wishlist-button';
import { NoImagePlaceholder } from './no-image-placeholder';

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
  layout?: 'vertical' | 'horizontal';
}

const getBadge = (title: string, category: string, id: string) => {
  const lowerTitle = title.toLowerCase();
  const lowerCat = category.toLowerCase();
  
  if (lowerTitle.includes('indigo') || lowerTitle.includes('scarf') || lowerCat === 'fashion') {
    return { text: 'CREATOR PICK', bg: 'bg-[#B0925A]' };
  }
  if (lowerTitle.includes('coconut') || lowerTitle.includes('shell') || lowerTitle.includes('bowl') || lowerTitle.includes('pot')) {
    return { text: 'TRENDING', bg: 'bg-[#D1A13B]' };
  }
  if (lowerTitle.includes('mocha') || lowerTitle.includes('espresso') || lowerTitle.includes('candle') || lowerTitle.includes('wax')) {
    return { text: 'VIRAL ON INSTAGRAM', bg: 'bg-[#D5006D]' };
  }
  if (lowerTitle.includes('portrait') || lowerTitle.includes('sketch') || lowerTitle.includes('line') || lowerTitle.includes('paint')) {
    return { text: 'RECENTLY ADDED', bg: 'bg-[#1E293B]' };
  }
  if (lowerTitle.includes('macrame') || lowerTitle.includes('bag') || lowerTitle.includes('india') || lowerTitle.includes('handcrafted')) {
    return { text: 'MADE IN INDIA', bg: 'bg-[#8c7343]' }; // warm earth green/gold
  }
  
  // Hash fallback
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const badges = [
    { text: 'CREATOR PICK', bg: 'bg-[#B0925A]' },
    { text: 'TRENDING', bg: 'bg-[#D1A13B]' },
    { text: 'VIRAL ON INSTAGRAM', bg: 'bg-[#D5006D]' },
    { text: 'RECENTLY ADDED', bg: 'bg-[#1E293B]' },
    { text: 'MADE IN INDIA', bg: 'bg-[#8c7343]' },
  ];
  return badges[hash % badges.length];
};

export function ProductCard({
  product,
  initialIsWishlisted = false,
  showWishlistButton = true,
  buyerMarketUrl = '',
  layout = 'vertical',
}: ProductCardProps) {
  const shopSlug = product.shop.slug;
  const productSlug = product.slug;
  const productUrl = `${buyerMarketUrl}/store/${shopSlug}/${productSlug}`;
  const isSoldOut = product.inStock === false;

  const badge = getBadge(product.title, product.category, product.id);

  if (layout === 'horizontal') {
    return (
      <div className="relative group w-full max-w-[640px] transition-all duration-300">
        <Link
          href={productUrl}
          className="block w-full bg-white dark:bg-zinc-900 border border-[#F0ECE3] dark:border-zinc-800/85 rounded-[24px] overflow-hidden flex flex-row justify-between cursor-pointer shadow-sm hover:shadow-lg transition-all duration-300 p-3 h-[180px]"
        >
          {/* Left: Card content (Details) */}
          <div className="p-3 pr-2 flex flex-col justify-between flex-grow min-w-0">
            <div>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block font-medium mb-1">
                by {product.shop.name}
              </span>
              <h3 className="font-serif text-base font-bold text-zinc-955 dark:text-white line-clamp-2 group-hover:text-[#A77F3A] transition-colors leading-snug">
                {product.title}
              </h3>
            </div>

            <div className="flex items-center justify-between mt-2">
              <div className="flex items-baseline gap-1.5">
                <span className="font-sans text-base font-extrabold text-zinc-950 dark:text-white">
                  ₹{Math.round(product.price)}
                </span>
                {product.compareAtPrice != null && product.compareAtPrice > product.price && (
                  <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500 line-through">
                    ₹{Math.round(product.compareAtPrice)}
                  </span>
                )}
              </div>
              
              {showWishlistButton && (
                <WishlistButton
                  productId={product.id}
                  initialIsWishlisted={initialIsWishlisted}
                  variant="minimal"
                />
              )}
            </div>
          </div>

          {/* Right: Product Image with inset look */}
          <div className="relative w-36 sm:w-44 overflow-hidden shrink-0 h-full bg-zinc-50 dark:bg-zinc-800/40 rounded-[18px]">
            {product.images?.[0] ? (
              <Image
                src={product.images[0].url}
                alt={product.title}
                fill
                className={`object-cover ${isSoldOut ? 'opacity-60 grayscale-[40%]' : ''}`}
                sizes="(max-width: 640px) 140px, 180px"
              />
            ) : (
              <NoImagePlaceholder />
            )}

            {/* Floating Badge */}
            <span className={`absolute top-2.5 left-2.5 z-10 text-[8px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded-md ${badge.bg} text-white shadow-sm scale-90 origin-top-left`}>
              {badge.text}
            </span>

            {/* Sold Out Badge */}
            {isSoldOut && (
              <span className="absolute bottom-2.5 left-2.5 z-10 px-2 py-0.5 rounded-md bg-zinc-950/80 text-white text-[8px] font-bold uppercase tracking-wide">
                Sold out
              </span>
            )}
          </div>
        </Link>
      </div>
    );
  }

  return (
    <div className="relative group w-full max-w-[290px] mx-auto sm:mx-0 transition-all duration-300">
      <Link
        href={productUrl}
        className="block bg-white dark:bg-zinc-900 border border-[#F0ECE3]/80 dark:border-zinc-800/85 rounded-[24px] overflow-hidden flex flex-col justify-between cursor-pointer shadow-sm hover:shadow-lg transition-all duration-300 p-3 h-full min-h-[370px]"
      >
        {/* Top: Product Image with inset padding and rounded corners */}
        <div className="relative aspect-[1.05] bg-zinc-50 dark:bg-zinc-800/40 rounded-[18px] overflow-hidden shrink-0">
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

          {/* Floating Badge */}
          <span className={`absolute top-3 left-3 z-10 text-[8px] sm:text-[9px] font-black tracking-wider uppercase px-2.5 py-1 rounded-[4px] ${badge.bg} text-white shadow-[0_2px_8px_rgba(0,0,0,0.08)]`}>
            {badge.text}
          </span>

          {/* Sold Out Badge */}
          {isSoldOut && (
            <span className="absolute bottom-3 left-3 z-10 px-2 py-0.5 rounded-md bg-zinc-950/80 text-white text-[9px] font-bold uppercase tracking-wide">
              Sold out
            </span>
          )}
        </div>

        {/* Bottom: Card content (Title, brand, price, wishlist heart) */}
        <div className="px-2 py-3.5 pb-2 flex flex-col justify-between flex-grow">
          <div>
            <span className="text-[11px] text-zinc-450 dark:text-zinc-500 block font-semibold tracking-wide mb-1 select-none">
              by {product.shop.name}
            </span>
            <h3 className="font-serif text-[15px] sm:text-base font-bold text-zinc-900 dark:text-white line-clamp-2 group-hover:text-[#A77F3A] transition-colors leading-snug">
              {product.title}
            </h3>
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="flex items-baseline gap-1.5">
              <span className="font-sans text-[16px] sm:text-lg font-black text-zinc-950 dark:text-white">
                ₹{Math.round(product.price)}
              </span>
              {product.compareAtPrice != null && product.compareAtPrice > product.price && (
                <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500 line-through">
                  ₹{Math.round(product.compareAtPrice)}
                </span>
              )}
            </div>

            {showWishlistButton && (
              <WishlistButton
                productId={product.id}
                initialIsWishlisted={initialIsWishlisted}
                variant="minimal"
                className="hover:scale-110"
              />
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}

export default ProductCard;
