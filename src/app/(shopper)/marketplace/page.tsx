import Link from 'next/link';
import Image from 'next/image';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { MarketplaceClient } from './marketplace-client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { auth } from '@/lib/auth';
import { WishlistButton } from '@/components/shared/wishlist-button';
import {
  ShoppingBag,
} from 'lucide-react';
import { Prisma } from '@prisma/client';
import { searchProductIds, ProductSearchSort } from '@/backend/lib/search';
import { generateItemListJSONLD, safeJsonLdStringify } from '@/lib/seo';
import { RecentlyViewedStrip } from '@/components/shared/recently-viewed';
import { logger } from '@/backend/lib/logger';
import type { Metadata } from 'next';

export async function generateMetadata({ searchParams }: MarketplacePageProps): Promise<Metadata> {
  const params = await searchParams;
  const category = params.category || '';
  const query = params.q || '';

  let title = 'Marketplace — Shop Direct from Independent Sellers';
  let description = 'Discover products from independent creators and order directly on WhatsApp. No checkout, no fees — chat to buy.';
  if (category) {
    title = `${category} — Seyon Marketplace`;
    description = `Browse ${category} products from independent sellers on Seyon. Chat on WhatsApp to buy directly.`;
  } else if (query) {
    title = `Search: ${query} — Seyon Marketplace`;
  }

  return {
    title,
    description,
    alternates: {
      // Filtered/sorted/paginated states canonicalize to the base marketplace URL
      canonical: '/marketplace',
    },
    robots: query ? { index: false, follow: true } : undefined,
  };
}

interface MarketplaceProduct {
  id: string;
  title: string;
  slug: string;
  price: number;
  compareAtPrice?: number | null;
  category: string;
  inStock?: boolean;
  shop: { name: string; slug: string; isVerified: boolean };
  images: { url: string }[];
}

interface MarketplacePageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    city?: string;
    inStock?: string;
    sort?: string;
    page?: string;
    minPrice?: string;
    maxPrice?: string;
  }>;
}

export default async function MarketplacePage({ searchParams }: MarketplacePageProps) {
  const session = await auth();
  const user = session?.user;

  const params = await searchParams;
  const query = params.q || '';
  const selectedCategory = params.category || '';
  const sort = params.sort || 'newest';
  const selectedCity = params.city || '';
  const inStockOnly = params.inStock === '1';
  const page = parseInt(params.page || '1', 10);
  const minPrice = params.minPrice || '';
  const maxPrice = params.maxPrice || '';
  const itemsPerPage = 8;

  let products: MarketplaceProduct[] = [];
  let totalProducts = 0;
  let categories: { name: string; count: number }[] = [];
  let cities: string[] = [];
  let wishlistedProductIds = new Set<string>();

  try {
    // Fetch user wishlist if authenticated
    if (user && user.id) {
      const userWishlist = await db.wishlist.findMany({
        where: { userId: user.id },
        select: { productId: true }
      });
      wishlistedProductIds = new Set(userWishlist.map((w) => w.productId));
    }

    // 1. Fetch available categories dynamically with product counts
    const categoriesRaw = await db.product.groupBy({
      by: ['category'],
      where: {
        status: 'ACTIVE',
        shop: { isSuspended: false, isPaused: false }
      },
      _count: {
        id: true,
      },
    });
    categories = categoriesRaw.map((c) => ({
      name: c.category,
      count: c._count.id,
    })).sort((a, b) => b.count - a.count); // Sort by popularity

    // Distinct seller cities for the location filter
    const cityRows = await db.shop.findMany({
      where: { isSuspended: false, isPaused: false, city: { not: null } },
      select: { city: true },
      distinct: ['city'],
      take: 100,
    });
    cities = cityRows.map((r) => r.city as string).sort();

    if (query) {
      // 2a. Text search: index-backed Postgres full-text search (GIN),
      // then hydrate the matched ids with their relations.
      const parsedMin = parseFloat(minPrice);
      const parsedMax = parseFloat(maxPrice);
      const minVal = !isNaN(parsedMin) ? Math.max(0, parsedMin) : undefined;
      const maxVal = !isNaN(parsedMax) ? Math.max(0, parsedMax) : undefined;
      const searchSort: ProductSearchSort =
        sort === 'price-asc' || sort === 'price-desc' || sort === 'newest' ? sort : 'relevance';

      const { ids, total } = await searchProductIds({
        query,
        category: selectedCategory || undefined,
        city: selectedCity || undefined,
        inStockOnly,
        minPrice: minVal,
        maxPrice: maxVal,
        sort: searchSort,
        page,
        perPage: itemsPerPage,
      });

      const found = await db.product.findMany({
        where: { id: { in: ids } },
        include: {
          images: { orderBy: { displayOrder: 'asc' }, take: 1 },
          shop: { select: { name: true, slug: true, isVerified: true } },
        },
      });
      const byId = new Map(found.map((prod) => [prod.id, prod]));
      products = ids.map((id) => byId.get(id)).filter((prod): prod is NonNullable<typeof prod> => Boolean(prod));
      totalProducts = total;
    } else {
      // 2b. Browse mode: standard filtered listing
      const filterConditions: Prisma.ProductWhereInput = {
        status: 'ACTIVE',
        shop: { isSuspended: false, isPaused: false },
      };

      if (selectedCategory) {
        filterConditions.category = selectedCategory;
      }

      if (selectedCity) {
        filterConditions.shop = {
          isSuspended: false,
          isPaused: false,
          city: { equals: selectedCity, mode: 'insensitive' },
        };
      }

      if (inStockOnly) {
        filterConditions.inStock = true;
      }

      if (minPrice || maxPrice) {
        const parsedMin = parseFloat(minPrice);
        const parsedMax = parseFloat(maxPrice);
        const priceFilter: Prisma.FloatFilter = {};
        if (!isNaN(parsedMin)) priceFilter.gte = Math.max(0, parsedMin);
        if (!isNaN(parsedMax)) priceFilter.lte = Math.max(0, parsedMax);
        filterConditions.price = priceFilter;
      }

      let orderBy: Prisma.ProductOrderByWithRelationInput[] = [{ inStock: 'desc' }, { createdAt: 'desc' }];
      if (sort === 'price-asc') orderBy = [{ inStock: 'desc' }, { price: 'asc' }];
      else if (sort === 'price-desc') orderBy = [{ inStock: 'desc' }, { price: 'desc' }];

      [products, totalProducts] = await Promise.all([
        db.product.findMany({
          where: filterConditions,
          include: {
            images: { orderBy: { displayOrder: 'asc' }, take: 1 },
            shop: { select: { name: true, slug: true, isVerified: true } },
          },
          orderBy,
          skip: (page - 1) * itemsPerPage,
          take: itemsPerPage,
        }),
        db.product.count({
          where: filterConditions,
        }),
      ]);
    }
  } catch (error) {
    logger.error('Error fetching marketplace products', error);
  }

  // Fallbacks if database is unmigrated or empty
  let categoriesData = categories;
  if (products.length === 0 && categories.length === 0) {
    categoriesData = [
      { name: 'Electronics', count: 2 },
      { name: 'Fashion', count: 1 },
      { name: 'Home & Living', count: 0 },
      { name: 'Beauty', count: 0 },
    ];
    products = [
      {
        id: '1',
        title: 'Mechanical Keychron K2 Keyboard',
        slug: 'mechanical-keychron-k2-keyboard',
        price: 89.99,
        category: 'Electronics',
        shop: { name: 'Gadget Central', slug: 'gadget-central', isVerified: true },
        images: [{ url: 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=600&h=450&q=80' }],
      },
      {
        id: '2',
        title: 'Sony WH-1000XM4 Headphones',
        slug: 'sony-wh1000xm4-headphones',
        price: 249.50,
        category: 'Electronics',
        shop: { name: 'Gadget Central', slug: 'gadget-central', isVerified: true },
        images: [{ url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&h=450&q=80' }],
      },
      {
        id: '3',
        title: 'Oversized Distressed Leather Jacket',
        slug: 'oversized-vintage-leather-jacket',
        price: 135.00,
        category: 'Fashion',
        shop: { name: 'Vogue Boutique', slug: 'vogue-boutique', isVerified: false },
        images: [{ url: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=600&h=450&q=80' }],
      },
    ];
    totalProducts = products.length;
  }

  const totalPages = Math.ceil(totalProducts / itemsPerPage);

  const itemListJsonLd = generateItemListJSONLD(
    selectedCategory ? `${selectedCategory} products on Seyon` : 'Seyon Marketplace products',
    products.map((prod) => ({
      title: prod.title,
      url: `/store/${prod.shop.slug}/${prod.slug}`,
    }))
  );

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(itemListJsonLd) }}
      />
      <MarketplaceClient
        categories={categoriesData}
        selectedCategory={selectedCategory}
        cities={cities}
        selectedCity={selectedCity}
        inStockOnly={inStockOnly}
        sort={sort}
        minPrice={minPrice}
        maxPrice={maxPrice}
        query={query}
      >
        {/* Products Grid */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <span className="text-sm text-muted-foreground">
              Showing <span className="text-foreground font-bold">{products.length}</span> of{' '}
              <span className="text-foreground font-bold">{totalProducts}</span> products
            </span>
          </div>

          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 border border-dashed border-zinc-200 rounded-xl bg-card shadow-sm">
              <ShoppingBag className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-bold text-foreground mb-1">No products found</h3>
              <p className="text-sm text-muted-foreground mb-6">Try refining your search terms or filters.</p>
              <Link href="/marketplace">
                <Button variant="outline">Clear All Filters</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {products.map((prod) => (
                <Link key={prod.id} href={`/store/${prod.shop.slug}/${prod.slug}`}>
                  <Card className="glass-hover overflow-hidden h-full flex flex-col justify-between cursor-pointer border-zinc-200 bg-card shadow-sm">
                    <div className="relative aspect-video bg-zinc-100 overflow-hidden">
                      {prod.images?.[0] ? (
                        <Image
                          src={prod.images[0].url}
                          alt={prod.title}
                          fill
                          className={`object-cover ${prod.inStock === false ? 'opacity-60 grayscale-[40%]' : ''}`}
                          sizes="(max-width: 768px) 50vw, 33vw"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">
                          No Image
                        </div>
                      )}
                      {prod.inStock === false && (
                        <span className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full bg-zinc-900/80 text-white text-[10px] font-bold uppercase tracking-wide">
                          Sold out
                        </span>
                      )}
                      <div className="absolute top-2 right-2 z-10">
                        <WishlistButton
                          productId={prod.id}
                          initialIsWishlisted={wishlistedProductIds.has(prod.id)}
                        />
                      </div>
                    </div>
                    <div className="p-4 flex flex-col justify-between flex-grow">
                      <div>
                        <div className="flex justify-between items-start gap-2 mb-1.5">
                          <span className="text-[10px] uppercase font-bold text-amber-700">
                            {prod.category}
                          </span>
                          <span className="text-xs text-muted-foreground text-right line-clamp-1 max-w-[120px]">
                            by {prod.shop.name}
                          </span>
                        </div>
                        <h3 className="font-bold text-foreground text-sm sm:text-base line-clamp-1 group-hover:text-amber-600 transition-colors">
                          {prod.title}
                        </h3>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3">
                        <span className="font-extrabold text-foreground text-base flex items-baseline gap-1.5">
                          ₹{prod.price.toFixed(2)}
                          {prod.compareAtPrice != null && prod.compareAtPrice > prod.price && (
                            <span className="text-xs font-normal text-muted-foreground line-through">₹{prod.compareAtPrice.toFixed(2)}</span>
                          )}
                        </span>
                        <Badge variant="success" className="text-[10px] font-bold">
                          {prod.inStock === false ? 'Ask seller' : 'WhatsApp Buy'}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-12 border-t border-zinc-200 pt-6">
              <Link href={`/marketplace?q=${query}&category=${selectedCategory}&sort=${sort}&page=${page - 1}`} className={page === 1 ? 'pointer-events-none opacity-40' : ''}>
                <Button variant="outline" size="sm">
                  Previous
                </Button>
              </Link>
              {Array.from({ length: totalPages }).map((_, idx) => {
                const pNum = idx + 1;
                return (
                  <Link key={pNum} href={`/marketplace?q=${query}&category=${selectedCategory}&sort=${sort}&page=${pNum}`}>
                    <Button variant={page === pNum ? 'default' : 'outline'} size="sm" className="h-8 w-8 p-0">
                      {pNum}
                    </Button>
                  </Link>
                );
              })}
              <Link href={`/marketplace?q=${query}&category=${selectedCategory}&sort=${sort}&page=${page + 1}`} className={page === totalPages ? 'pointer-events-none opacity-40' : ''}>
                <Button variant="outline" size="sm">
                  Next
                </Button>
              </Link>
            </div>
          )}
        </div>
      </MarketplaceClient>
      <RecentlyViewedStrip />
    </div>
  );
}
export const revalidate = 60;
