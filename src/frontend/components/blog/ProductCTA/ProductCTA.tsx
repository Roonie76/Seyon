import Link from 'next/link';
import { db } from '@/lib/db';
import { Star } from 'lucide-react';

interface ProductCTAProps {
  slug: string;
}

export async function ProductCTA({ slug }: ProductCTAProps) {
  // Query product from DB
  const product = await db.product.findFirst({
    where: {
      slug: slug,
      status: 'ACTIVE',
    },
    include: {
      images: {
        orderBy: { displayOrder: 'asc' },
        take: 1,
      },
      shop: {
        select: { slug: true },
      },
    },
  });

  // Mock fallback if product slug doesn't exist in catalog yet
  const displayProduct = product
    ? {
        title: product.title,
        price: product.price,
        imageUrl: product.images[0]?.url || 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=400',
        href: `/store/${product.shop.slug}/${product.slug}`,
      }
    : {
        title: 'Luxury Gold Bracelet',
        price: 2499,
        imageUrl: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?q=80&w=400',
        href: '/marketplace',
      };

  return (
    <div className="my-10 mx-auto max-w-xl p-6 rounded-2xl border border-zinc-900 bg-[#0f0f0f] flex flex-col sm:flex-row items-center gap-6 group hover:border-[#D4AF37]/30 transition-all duration-500 hover:shadow-[0_10px_30px_rgba(212,175,55,0.03)]">
      {/* Product Image */}
      <div className="h-32 w-32 shrink-0 rounded-xl overflow-hidden bg-white flex items-center justify-center p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={displayProduct.imageUrl}
          alt={displayProduct.title}
          className="max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-105"
        />
      </div>

      {/* Product Info */}
      <div className="flex-grow space-y-3 text-center sm:text-left">
        <div>
          <span className="text-[9px] font-black uppercase tracking-[0.25em] text-[#D4AF37]">
            Shop This Story
          </span>
          <h4 className="text-lg font-bold text-white uppercase tracking-wider line-clamp-1 mt-1">
            {displayProduct.title}
          </h4>
        </div>

        {/* Stars */}
        <div className="flex justify-center sm:justify-start items-center gap-1 text-[#D4AF37]">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={11} className="fill-current" />
          ))}
        </div>

        <p className="text-sm font-semibold font-mono text-[#E4C29D]">
          ₹{displayProduct.price.toLocaleString('en-IN')}
        </p>

        <div className="pt-2">
          <Link
            href={displayProduct.href}
            className="inline-flex items-center justify-center rounded-sm bg-black border border-zinc-800 px-6 py-2.5 text-[9px] font-black text-[#D4AF37] tracking-[0.15em] uppercase transition-all duration-300 hover:border-[#D4AF37] hover:bg-[#D4AF37] hover:text-black"
          >
            View Product
          </Link>
        </div>
      </div>
    </div>
  );
}
