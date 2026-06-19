'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Heart } from 'lucide-react';
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

  return (
    <div className="relative group h-full">
      {/* Background soft glow animation on hover */}
      <div className="absolute -inset-1 bg-gradient-to-tr from-amber-500/10 to-yellow-600/10 rounded-[30px] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />

      <Link
        href={productUrl}
        className="block h-full bg-[#F4F1EA] dark:bg-zinc-900/90 border border-[#E7E2D8] dark:border-zinc-800/80 rounded-[28px] overflow-hidden flex flex-col justify-between cursor-pointer shadow-sm hover:shadow-xl transition-all duration-300 ease-out hover:-translate-y-1"
      >
        {/* Top: Product Image with fade bottom */}
        <div className="relative aspect-[3/4] bg-zinc-100 overflow-hidden shrink-0">
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
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#F4F1EA] via-[#F4F1EA]/50 to-transparent dark:from-zinc-900 dark:via-zinc-900/50 pointer-events-none" />

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
            <h3 className="font-bold text-zinc-900 dark:text-white text-base md:text-lg line-clamp-1 group-hover:text-amber-700 dark:group-hover:text-amber-500 transition-colors">
              {product.title}
            </h3>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 block">
              by {product.shop.name}
            </span>

            {/* Short divider line exactly like CalmLights candle screenshot */}
            <div className="w-8 h-0.5 bg-zinc-350 dark:bg-zinc-700 mt-3 mb-2.5" />

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
          <div className="mt-5 flex items-center justify-between border-t border-zinc-200/50 dark:border-zinc-800/50 pt-4 gap-2">
            {/* Category pill */}
            <span className="text-[10px] uppercase font-extrabold text-emerald-850 dark:text-emerald-400 border border-emerald-850/15 dark:border-emerald-500/25 bg-emerald-850/5 dark:bg-emerald-500/10 px-3 py-1 rounded-full truncate max-w-[100px] sm:max-w-[120px]">
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
