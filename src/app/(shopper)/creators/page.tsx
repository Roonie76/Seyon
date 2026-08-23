import Link from 'next/link';
import { SafeImage as Image } from '@/components/shared/safe-image';
import { db } from '@/lib/db';
import { BackButton } from '@/components/shared/back-button';
import { Breadcrumbs } from '@/components/shared/breadcrumbs';
import { Check } from 'lucide-react';
import { getCreatorPresentation } from '@/lib/demo';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Meet All Creators | Seyon',
  description: 'Discover independent designers, artists, and creators from all over India on Seyon.',
};

// Rendered per request: the shopper layout's Navbar calls auth(), which reads
// cookies and makes every route in this group dynamic regardless. The previous
// `export const revalidate` was therefore inert AND harmful — on the two /store
// routes it turned notFound() into a soft 404 (HTTP 200 with not-found copy),
// so search engines kept indexing deleted products.

interface CreatorsPageProps {
  searchParams: Promise<{ sort?: string }>;
}

export default async function CreatorsPage({ searchParams }: CreatorsPageProps) {
  const params = await searchParams;
  const sort = params.sort;

  let creators: any[] = [];
  try {
    creators = await db.shop.findMany({
      where: { isSuspended: false, isPaused: false },
      include: {
        products: {
          where: { status: 'ACTIVE' },
          include: { images: { take: 1 } },
          take: 1,
        },
        _count: {
          select: { products: { where: { status: 'ACTIVE' } } }
        }
      },
      orderBy: sort === 'newest' ? { createdAt: 'desc' } : { reviewCount: 'desc' }
    });
  } catch (error) {
    console.error('Error loading creators list', error);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-8 animate-fade-in bg-white">
      {/* Page Header Navigation & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <BackButton fallbackHref="/" label="Marketplace" className="font-serif !text-base font-bold text-zinc-900" />
        <Breadcrumbs items={[{ label: 'Creators' }]} />
      </div>

      <div className="border-b border-zinc-200/85 pb-6">
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-zinc-955 leading-tight">
          Meet Our Creators
        </h1>
        <p className="text-zinc-500 text-sm font-sans mt-2">
          Discover independent brands and creators selling directly on Instagram, WhatsApp & Telegram
        </p>
      </div>

      {creators.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-zinc-500 text-sm">No creators active at this moment. Check back soon!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {creators.map((shop) => {
            const bgProdImg = shop.products?.[0]?.images?.[0]?.url || '';
            const presentation = getCreatorPresentation(shop);
            return (
              <div
                key={shop.slug}
                className="bg-white border border-[#F0ECE3] rounded-3xl overflow-hidden shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between text-left p-4 select-none group h-full"
              >
                {/* Top half: Product dynamic thumbnail */}
                <div className="relative aspect-[4/3] w-full bg-zinc-50 border border-zinc-150 rounded-2xl overflow-hidden mb-4 shrink-0">
                  {bgProdImg ? (
                    <Image
                      src={bgProdImg}
                      alt={shop.name}
                      fill
                      className="object-cover group-hover:scale-103 transition-transform duration-300"
                      sizes="200px"
                    />
                  ) : (
                    <div className="h-full w-full bg-amber-50 flex items-center justify-center text-lg font-bold text-amber-700 uppercase">
                      {shop.name[0]}
                    </div>
                  )}
                </div>

                {/* Bottom half: Details & visit button */}
                <div className="flex flex-col flex-1 justify-between">
                  <div>
                    <h3 className="font-serif text-base font-bold text-zinc-950 flex items-center gap-1 leading-tight group-hover:text-[#A77F3A] transition-colors">
                      {shop.name}
                      {shop.isVerified && (
                        <span className="bg-emerald-500 text-white rounded-full p-0.5 leading-none scale-85 shrink-0 flex items-center justify-center">
                          <Check className="h-2.5 w-2.5 text-white stroke-[4]" />
                        </span>
                      )}
                    </h3>
                    
                    {/* Rating block — real reviews only; never a placeholder */}
                    <div className="flex items-center gap-1 mt-1.5">
                      {presentation.rating != null ? (
                        <span className="text-[9px] font-extrabold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 uppercase tracking-wide flex items-center gap-0.5 leading-none">
                          ⭐ {presentation.rating.toFixed(1)} <span className="text-zinc-455 font-medium normal-case">({shop.reviewCount})</span>
                        </span>
                      ) : (
                        <span className="text-[9px] font-extrabold text-zinc-500 bg-zinc-50 px-1.5 py-0.5 rounded border border-zinc-150 uppercase tracking-wide leading-none">
                          New seller
                        </span>
                      )}
                    </div>

                    {/* Trust metrics */}
                    {presentation.trustTag && (
                      <p className="text-[10px] text-zinc-600 mt-3 font-semibold flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {presentation.trustTag}
                      </p>
                    )}
                    <p className="text-[9px] text-zinc-400 mt-1 uppercase tracking-wider font-bold">
                      {presentation.location ? `${presentation.location} • ` : ''}{shop._count.products} Products
                    </p>
                  </div>

                  <Link
                    href={`/store/${shop.slug}`}
                    className="w-full mt-5 py-2.5 bg-zinc-50 hover:bg-[#1A1A18] text-zinc-800 hover:text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl border border-zinc-200 hover:border-[#1A1A18] transition-all text-center block shadow-2xs select-none active:scale-97 cursor-pointer"
                  >
                    Visit Store
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
