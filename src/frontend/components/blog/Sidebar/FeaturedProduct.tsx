import Link from 'next/link';
import { Star, ChevronLeft, ChevronRight } from 'lucide-react';

interface ProductData {
  title: string;
  price: number;
  imageUrl: string;
  slug: string;
  shopSlug?: string;
  rating?: number;
}

interface FeaturedProductProps {
  product?: ProductData | null;
  titleLabel?: string;
}

export function FeaturedProduct({ product, titleLabel = 'Featured Product' }: FeaturedProductProps) {
  // Graceful fallback to luxury mock jewelry item
  const displayProduct: ProductData = product || {
    title: 'Cape Gold For Women',
    price: 9999,
    imageUrl: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=600',
    slug: 'cape-gold-for-women',
    rating: 5,
  };

  const getProductHref = () => {
    if (displayProduct.shopSlug) {
      return `/store/${displayProduct.shopSlug}/${displayProduct.slug}`;
    }
    return `/marketplace`;
  };

  return (
    <div className="space-y-6">
      <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-[#D4AF37] border-b border-zinc-900 pb-3">
        {titleLabel}
      </h4>

      <div className="group relative rounded-2xl overflow-hidden border border-zinc-900 bg-[#0f0f0f] p-6 text-center transition-all duration-500 hover:border-zinc-800 hover:shadow-[0_15px_30px_rgba(0,0,0,0.5)]">
        {/* Product Image */}
        <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-white mb-6 flex items-center justify-center p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayProduct.imageUrl}
            alt={displayProduct.title}
            className="max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-105"
          />
        </div>

        {/* Info */}
        <div className="space-y-2">
          {/* Stars */}
          <div className="flex justify-center items-center gap-1 text-[#D4AF37]">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={12} className="fill-current" />
            ))}
          </div>

          <h5 className="text-sm font-bold text-white uppercase tracking-wider line-clamp-1">
            {displayProduct.title}
          </h5>

          <p className="text-xs font-semibold font-mono text-[#E4C29D]">
            ₹{displayProduct.price.toLocaleString('en-IN')}
          </p>

          {/* Action Button */}
          <div className="pt-4">
            <Link
              href={getProductHref()}
              className="inline-flex w-full items-center justify-center rounded-sm bg-[#050505] border border-zinc-800 py-3 text-[10px] font-black text-[#D4AF37] tracking-[0.15em] uppercase transition-all duration-300 hover:border-[#D4AF37] hover:bg-[#D4AF37] hover:text-black"
            >
              View Product
            </Link>
          </div>
        </div>

        {/* Carousel indicator controls shown in screenshot */}
        <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button className="h-6 w-6 rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-white hover:text-[#D4AF37] transition-colors">
            <ChevronLeft size={10} />
          </button>
          <button className="h-6 w-6 rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-white hover:text-[#D4AF37] transition-colors">
            <ChevronRight size={10} />
          </button>
        </div>
      </div>
    </div>
  );
}
