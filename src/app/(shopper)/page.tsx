import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db';
import { ProductCard } from '@/components/shared/product-card';
import { ProductCarousel } from '@/components/shared/product-carousel';
import { HomepageSearch } from '@/components/shared/homepage-search';
import { ArrowRight } from 'lucide-react';

import { auth } from '@/lib/auth';
import { MarketplaceClient } from './marketplace/marketplace-client';
import { searchProductIds, ProductSearchSort } from '@/backend/lib/search';
import { generateItemListJSONLD, safeJsonLdStringify } from '@/lib/seo';
import { RecentlyViewedStrip } from '@/components/shared/recently-viewed';
import { logger } from '@/backend/lib/logger';
import { Prisma } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { ShoppingBag } from 'lucide-react';

interface ProductRow {
  id: string;
}

// 1. Cached Query: Top Offers (5 min TTL)
const getTopOffers = unstable_cache(
  async () => {
    return db.product.findMany({
      where: {
        status: 'ACTIVE',
        shop: { isSuspended: false, isPaused: false },
        discountPercent: { not: null },
      },
      include: {
        images: { orderBy: { displayOrder: 'asc' }, take: 1 },
        shop: { select: { name: true, slug: true, isVerified: true } },
      },
      orderBy: { discountPercent: 'desc' },
      take: 4,
    });
  },
  ['homepage-top-offers'],
  { revalidate: 300, tags: ['homepage-top-offers'] }
);

// 2. Cached Query: New Arrivals (2 min TTL, Carousel)
const getNewArrivals = unstable_cache(
  async () => {
    return db.product.findMany({
      where: {
        status: 'ACTIVE',
        shop: { isSuspended: false, isPaused: false },
      },
      include: {
        images: { orderBy: { displayOrder: 'asc' }, take: 1 },
        shop: { select: { name: true, slug: true, isVerified: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });
  },
  ['homepage-new-arrivals-v2'],
  { revalidate: 120, tags: ['homepage-new-arrivals-v2'] }
);

// 3. Cached Query: Category Spotlight (15 min TTL, 2x2 box)
const getCategorySpotlight = unstable_cache(
  async () => {
    const categoryGroups = await db.product.groupBy({
      by: ['category'],
      where: {
        status: 'ACTIVE',
        shop: { isSuspended: false, isPaused: false },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 1,
    });

    const spotlightCategory = categoryGroups[0]?.category ?? null;

    if (!spotlightCategory) return { category: null, products: [] };

    const products = await db.product.findMany({
      where: {
        category: spotlightCategory,
        status: 'ACTIVE',
        shop: { isSuspended: false, isPaused: false },
      },
      include: {
        images: { orderBy: { displayOrder: 'asc' }, take: 1 },
        shop: { select: { name: true, slug: true } },
      },
      take: 4,
    });

    return { category: spotlightCategory, products };
  },
  ['homepage-category-spotlight'],
  { revalidate: 900, tags: ['homepage-category-spotlight'] }
);

// 4. Cached Query: Popular Categories (15 min TTL, 2x2 box)
const getPopularCategories = unstable_cache(
  async () => {
    const groups = await db.product.groupBy({
      by: ['category'],
      where: {
        status: 'ACTIVE',
        shop: { isSuspended: false, isPaused: false },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 4,
    });

    const categoriesWithImages = [];
    for (const group of groups) {
      const firstProduct = await db.product.findFirst({
        where: { category: group.category, status: 'ACTIVE' },
        select: { images: { select: { url: true }, take: 1 } },
      });
      categoriesWithImages.push({
        name: group.category,
        image: firstProduct?.images[0]?.url || null,
      });
    }
    return categoriesWithImages;
  },
  ['homepage-popular-categories'],
  { revalidate: 900, tags: ['homepage-popular-categories'] }
);

// 5. Cached Query: Verified Shops (10 min TTL, 2x2 box)
const getVerifiedShops = unstable_cache(
  async () => {
    return db.shop.findMany({
      where: { isSuspended: false, isPaused: false, isVerified: true },
      select: { name: true, slug: true, logo: true },
      take: 4,
    });
  },
  ['homepage-verified-shops'],
  { revalidate: 600, tags: ['homepage-verified-shops'] }
);

// 6. Cached Query: Verified Picks (10 min TTL, Random order, Carousel)
const getVerifiedPicks = unstable_cache(
  async () => {
    const verifiedPicks = await db.$queryRaw<ProductRow[]>`
      SELECT p.id FROM "Product" p
      JOIN "Shop" s ON p."shopId" = s.id
      WHERE p.status = 'ACTIVE'
        AND s."isSuspended" = false
        AND s."isPaused" = false
        AND s."isVerified" = true
      ORDER BY RANDOM()
      LIMIT 8
    `;

    const verifiedPickIds = verifiedPicks.map((p) => p.id);
    if (verifiedPickIds.length === 0) return [];

    return db.product.findMany({
      where: { id: { in: verifiedPickIds } },
      include: {
        images: { orderBy: { displayOrder: 'asc' }, take: 1 },
        shop: { select: { name: true, slug: true, isVerified: true } },
      },
    });
  },
  ['homepage-verified-picks-v2'],
  { revalidate: 600, tags: ['homepage-verified-picks-v2'] }
);

type SearchProduct = Prisma.ProductGetPayload<{
  include: {
    images: { select: { url: true } };
    shop: { select: { name: true; slug: true; isVerified: true } };
  };
}>;

interface HomePageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    city?: string;
    inStock?: string;
    sort?: string;
    page?: string;
    minPrice?: string;
    maxPrice?: string;
    rating?: string;
  }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const hasFilters =
    params.q !== undefined ||
    params.category !== undefined ||
    params.city !== undefined ||
    params.sort !== undefined ||
    params.inStock !== undefined ||
    params.page !== undefined ||
    params.minPrice !== undefined ||
    params.maxPrice !== undefined ||
    params.rating !== undefined;

  // --- CASE A: Search Results/Catalog view if parameters are present ---
  if (hasFilters) {
    const session = await auth();
    const user = session?.user;

    const query = params.q || '';
    const selectedCategory = params.category || '';
    const sort = params.sort || (query ? 'relevance' : 'newest');
    const selectedCity = params.city || '';
    const inStockOnly = params.inStock === '1';
    const page = parseInt(params.page || '1', 10);
    const minPrice = params.minPrice || '';
    const maxPrice = params.maxPrice || '';
    const rating = params.rating || '';
    const itemsPerPage = 8;

    let products: SearchProduct[] = [];
    let discoveryProducts: SearchProduct[] = [];
    let totalProducts = 0;
    let categories: { name: string; count: number }[] = [];
    let cities: string[] = [];
    let wishlistedProductIds = new Set<string>();

    try {
      if (user && user.id) {
        const userWishlist = await db.wishlist.findMany({
          where: { userId: user.id },
          select: { productId: true }
        });
        wishlistedProductIds = new Set(userWishlist.map((w) => w.productId));
      }

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
      })).sort((a, b) => b.count - a.count);

      const cityRows = await db.shop.findMany({
        where: { isSuspended: false, isPaused: false, city: { not: null } },
        select: { city: true },
        distinct: ['city'],
        take: 100,
      });
      cities = cityRows.map((r) => r.city as string).sort();

      if (query) {
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
          rating: rating ? parseFloat(rating) : undefined,
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

        if (products.length < 4) {
          discoveryProducts = await db.product.findMany({
            where: {
              id: { notIn: products.map((product) => product.id) },
              status: 'ACTIVE',
              shop: { isSuspended: false, isPaused: false },
            },
            include: {
              images: { orderBy: { displayOrder: 'asc' }, take: 1 },
              shop: { select: { name: true, slug: true, isVerified: true } },
            },
            orderBy: [{ inStock: 'desc' }, { createdAt: 'desc' }],
            take: 4,
          });
        }
      } else {
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

        if (rating) {
          const ratingVal = parseFloat(rating);
          if (!isNaN(ratingVal)) {
            filterConditions.shop = {
              ...(filterConditions.shop as Prisma.ShopWhereInput),
              averageRating: { gte: ratingVal },
            };
          }
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
      logger.error('Error fetching products for catalog view', error);
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
          categories={categories}
          selectedCategory={selectedCategory}
          cities={cities}
          selectedCity={selectedCity}
          inStockOnly={inStockOnly}
          sort={sort}
          minPrice={minPrice}
          maxPrice={maxPrice}
          rating={rating}
          query={query}
        >
          <div>
            <div className="flex flex-col gap-1 mb-6">
              {query && (
                <h2 className="text-2xl font-black tracking-tight text-foreground">
                  Results for &ldquo;{query}&rdquo;
                </h2>
              )}
              <span className="text-sm text-muted-foreground">
                Showing <span className="text-foreground font-bold">{products.length}</span> of{' '}
                <span className="text-foreground font-bold">{totalProducts}</span>{' '}
                {query ? 'matching and related products' : 'products'}
              </span>
            </div>

            {products.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 border border-dashed border-zinc-200 rounded-xl bg-card shadow-sm">
                <ShoppingBag className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-bold text-foreground mb-1">No products found</h3>
                <p className="text-sm text-muted-foreground mb-6">Try refining your search terms or filters.</p>
                <Link href="/">
                  <Button variant="outline">Clear All Filters</Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 justify-items-center max-w-6xl mx-auto w-full">
                {products.map((prod) => (
                  <ProductCard
                    key={prod.id}
                    product={prod}
                    initialIsWishlisted={wishlistedProductIds.has(prod.id)}
                    layout="vertical"
                  />
                ))}
              </div>
            )}

            {totalPages > 1 && (() => {
              const paginationParams = new URLSearchParams();
              if (query) paginationParams.set('q', query);
              if (selectedCategory) paginationParams.set('category', selectedCategory);
              if (selectedCity) paginationParams.set('city', selectedCity);
              if (inStockOnly) paginationParams.set('inStock', '1');
              if (sort && sort !== 'newest') paginationParams.set('sort', sort);
              if (minPrice) paginationParams.set('minPrice', minPrice);
              if (maxPrice) paginationParams.set('maxPrice', maxPrice);
              if (rating) paginationParams.set('rating', rating);
              const baseQs = paginationParams.toString();
              const buildUrl = (p: number) => `/?${baseQs}${baseQs ? '&' : ''}page=${p}`;
              return (
                <div className="flex items-center justify-center gap-2 mt-12 border-t border-zinc-200 pt-6">
                  <Link href={buildUrl(page - 1)} className={page === 1 ? 'pointer-events-none opacity-40' : ''}>
                    <Button variant="outline" size="sm">
                      Previous
                    </Button>
                  </Link>
                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const pNum = idx + 1;
                    return (
                      <Link key={pNum} href={buildUrl(pNum)}>
                        <Button variant={page === pNum ? 'default' : 'outline'} size="sm" className="h-8 w-8 p-0">
                          {pNum}
                        </Button>
                      </Link>
                    );
                  })}
                  <Link href={buildUrl(page + 1)} className={page === totalPages ? 'pointer-events-none opacity-40' : ''}>
                    <Button variant="outline" size="sm">
                      Next
                    </Button>
                  </Link>
                </div>
              );
            })()}

            {query && discoveryProducts.length > 0 && (
              <section className="mt-14 border-t border-border pt-10 w-full max-w-6xl mx-auto">
                <div className="mb-6 text-left">
                  <h2 className="text-2xl font-black tracking-tight text-foreground">
                    More products to explore
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Fresh listings you may also like.
                  </p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 justify-items-center max-w-6xl mx-auto w-full">
                  {discoveryProducts.map((prod) => (
                    <ProductCard
                      key={prod.id}
                      product={prod}
                      initialIsWishlisted={wishlistedProductIds.has(prod.id)}
                      layout="vertical"
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        </MarketplaceClient>
        <RecentlyViewedStrip />
      </div>
    );
  }

  // --- CASE B: Amazon-style high-density Landing/Dashboard view ---
  // Execute all database fetches in parallel
  const [topOffers, newArrivals, spotlightData, popularCategories, verifiedShops, verifiedPicks] = await Promise.all([
    getTopOffers(),
    getNewArrivals(),
    getCategorySpotlight(),
    getPopularCategories(),
    getVerifiedShops(),
    getVerifiedPicks(),
  ]);

  const spotlightCategory = spotlightData.category;
  const spotlightProducts = spotlightData.products;

  const categoriesList = [
    { name: 'Electronics', slug: 'electronics' },
    { name: 'Fashion', slug: 'fashion' },
    { name: 'Home & Living', slug: 'home-living' },
    { name: 'Beauty', slug: 'beauty' },
    { name: 'Art & Craft', slug: 'art-craft' },
    { name: 'Toys', slug: 'toys' }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#EAEDED] text-zinc-900 antialiased pb-16">
      {/* 1. Hero Search Section with Amazon-style light gradient */}
      <section className="relative overflow-hidden pt-20 pb-36 bg-gradient-to-b from-[#EAEDED] via-[#EAEDED]/70 to-transparent text-center px-4">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full bg-amber-500/5 blur-3xl -z-10" />

        <div className="max-w-2xl mx-auto flex flex-col items-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold bg-amber-500/10 text-amber-700 border border-amber-500/25 uppercase tracking-widest mb-4">
            Shop Direct & Save
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-zinc-900 tracking-tight leading-none mb-4">
            Discover Unique Items <br />
            <span className="bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text text-transparent">
              Direct from Creators
            </span>
          </h1>
          <p className="text-zinc-650 text-xs sm:text-sm max-w-lg mb-8 leading-relaxed font-medium">
            Connecting you directly with independent storefronts. Order straight on WhatsApp with no middleman transaction fees.
          </p>

          <HomepageSearch />

          {/* Quick-links suggestion tags */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-zinc-500">
            <span className="font-semibold text-zinc-400">Try searching:</span>
            {['Resin Art', 'Mug', 'Leather Jacket', 'Sony'].map((term) => (
              <Link
                key={term}
                href={`/?q=${encodeURIComponent(term)}`}
                className="hover:text-amber-600 hover:underline transition-colors font-medium text-zinc-600"
              >
                {term}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 2. Visual Categories Quick-Bar (Light theme) */}
      <section className="bg-white border-b border-zinc-200 py-3.5 shadow-xs relative z-10 -mt-10 mb-6">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-center gap-2 md:gap-3 overflow-x-auto no-scrollbar py-1">
            {categoriesList.map((cat) => (
              <Link
                key={cat.name}
                href={`/?category=${encodeURIComponent(cat.name)}`}
                className="shrink-0 px-4 py-2 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 hover:border-amber-500/50 text-zinc-700 hover:text-zinc-900 rounded-full text-xs font-bold transition-all duration-300 cursor-pointer select-none active:scale-95"
              >
                {cat.name}
              </Link>
            ))}
            <Link
              href="/"
              className="shrink-0 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-full text-xs font-extrabold transition-all duration-300 shadow-xs cursor-pointer select-none active:scale-95 uppercase tracking-wider"
            >
              All Products
            </Link>
          </div>
        </div>
      </section>

      {/* 3. Overlapping Dashboard Grid Card Deck */}
      <main className="relative z-10 container mx-auto px-4 sm:px-6 flex-grow flex flex-col gap-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">

          {/* Card 1: Hot Deals (2x2 Box) */}
          {topOffers.length > 0 && (
            <div className="bg-white border border-zinc-200 rounded-[32px] p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between h-[450px]">
              <div>
                <h2 className="text-lg font-black text-zinc-900 tracking-tight mb-4 flex items-center gap-1.5">
                  Hot Discounts
                </h2>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {topOffers.map((prod) => {
                    const discount = prod.discountPercent ? Math.round(prod.discountPercent * 100) : 0;
                    return (
                      <Link
                        key={prod.id}
                        href={`/store/${prod.shop.slug}/${prod.slug}`}
                        className="group flex flex-col justify-between h-[155px]"
                      >
                        <div className="relative aspect-square w-full rounded-2xl bg-zinc-50 border border-zinc-100 overflow-hidden mb-1.5">
                          {prod.images?.[0] ? (
                            <Image
                              src={prod.images[0].url}
                              alt={prod.title}
                              fill
                              sizes="120px"
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-zinc-400">No Image</div>
                          )}
                          {discount > 0 && (
                            <span className="absolute top-1.5 left-1.5 z-10 bg-crimson text-white text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md leading-none">
                              {discount}% OFF
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[11px] font-bold text-zinc-800 truncate leading-tight group-hover:text-amber-600 transition-colors">
                            {prod.title}
                          </span>
                          <span className="text-[11px] font-extrabold text-zinc-950 mt-0.5">
                            ₹{prod.price.toFixed(0)}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
              <Link
                href="/"
                className="text-xs font-extrabold text-amber-600 hover:text-amber-700 flex items-center gap-1 transition-colors mt-2"
              >
                See all deals &rarr;
              </Link>
            </div>
          )}

          {/* Card 2: Spotlight Box (2x2 Box) */}
          {spotlightProducts.length > 0 && spotlightCategory && (
            <div className="bg-white border border-zinc-200 rounded-[32px] p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between h-[450px]">
              <div>
                <h2 className="text-lg font-black text-zinc-900 tracking-tight mb-4 flex items-center gap-1.5">
                  Spotlight: {spotlightCategory}
                </h2>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {spotlightProducts.map((prod) => (
                    <Link
                      key={prod.id}
                      href={`/store/${prod.shop.slug}/${prod.slug}`}
                      className="group flex flex-col justify-between h-[155px]"
                    >
                      <div className="relative aspect-square w-full rounded-2xl bg-zinc-50 border border-zinc-100 overflow-hidden mb-1.5">
                        {prod.images?.[0] ? (
                          <Image
                            src={prod.images[0].url}
                            alt={prod.title}
                            fill
                            sizes="120px"
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-zinc-400">No Image</div>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] font-bold text-zinc-800 truncate leading-tight group-hover:text-amber-600 transition-colors">
                          {prod.title}
                        </span>
                        <span className="text-[11px] font-extrabold text-zinc-950 mt-0.5">
                          ₹{prod.price.toFixed(0)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
              <Link
                href={`/?category=${encodeURIComponent(spotlightCategory)}`}
                className="text-xs font-extrabold text-amber-600 hover:text-amber-700 flex items-center gap-1 transition-colors mt-2"
              >
                Explore category &rarr;
              </Link>
            </div>
          )}

          {/* Card 3: Shop by Category (2x2 Box) */}
          {popularCategories.length > 0 && (
            <div className="bg-white border border-zinc-200 rounded-[32px] p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between h-[450px]">
              <div>
                <h2 className="text-lg font-black text-zinc-900 tracking-tight mb-4 flex items-center gap-1.5">
                  Popular Categories
                </h2>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {popularCategories.map((cat) => (
                    <Link
                      key={cat.name}
                      href={`/?category=${encodeURIComponent(cat.name)}`}
                      className="group flex flex-col justify-between h-[155px]"
                    >
                      <div className="relative aspect-square w-full rounded-2xl bg-zinc-50 border border-zinc-100 overflow-hidden mb-1.5">
                        {cat.image ? (
                          <Image
                            src={cat.image}
                            alt={cat.name}
                            fill
                            sizes="120px"
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-zinc-400 font-semibold bg-zinc-100 text-zinc-500 uppercase">{cat.name[0]}</div>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] font-bold text-zinc-800 truncate leading-tight group-hover:text-amber-600 transition-colors">
                          {cat.name}
                        </span>
                        <span className="text-[10px] text-zinc-400 mt-0.5">Explore collections</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
              <Link
                href="/"
                className="text-xs font-extrabold text-amber-600 hover:text-amber-700 flex items-center gap-1 transition-colors mt-2"
              >
                Browse catalog &rarr;
              </Link>
            </div>
          )}

          {/* Card 4: Verified Storefronts (2x2 Box) */}
          {verifiedShops.length > 0 && (
            <div className="bg-white border border-zinc-200 rounded-[32px] p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between h-[450px]">
              <div>
                <h2 className="text-lg font-black text-zinc-900 tracking-tight mb-4 flex items-center gap-1.5">
                  Top Storefronts
                </h2>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {verifiedShops.map((shop) => (
                    <Link
                      key={shop.slug}
                      href={`/store/${shop.slug}`}
                      className="group flex flex-col justify-between h-[155px]"
                    >
                      <div className="relative aspect-square w-full rounded-2xl bg-zinc-50 border border-zinc-100 overflow-hidden mb-1.5 flex items-center justify-center">
                        {shop.logo ? (
                          <Image
                            src={shop.logo}
                            alt={shop.name}
                            fill
                            sizes="120px"
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-sm font-bold text-amber-600 group-hover:scale-105 transition-transform">
                            {shop.name[0].toUpperCase()}
                          </div>
                        )}
                        <span className="absolute bottom-1.5 right-1.5 z-10 bg-emerald-500 text-white text-[8px] font-extrabold uppercase px-1 py-0.5 rounded-sm leading-none flex items-center gap-0.5">
                          Verified
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] font-bold text-zinc-800 truncate leading-tight group-hover:text-amber-600 transition-colors">
                          {shop.name}
                        </span>
                        <span className="text-[10px] text-zinc-400 mt-0.5">Visit Storefront</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
              <Link
                href="/"
                className="text-xs font-extrabold text-amber-600 hover:text-amber-700 flex items-center gap-1 transition-colors mt-2"
              >
                All storefronts &rarr;
              </Link>
            </div>
          )}

        </div>

        {/* Horizontal Scroll Carousel: New Arrivals */}
        {newArrivals.length > 0 && (
          <section className="bg-white border border-zinc-200 rounded-[32px] p-6 md:p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-zinc-950 tracking-tight flex items-center gap-2">
                  New Arrivals
                </h2>
                <p className="text-zinc-500 text-xs mt-1">Freshly listed products from independent creators.</p>
              </div>
              <Link
                href="/?sort=newest"
                className="text-xs font-extrabold text-amber-600 hover:text-amber-700 flex items-center gap-1 group/link transition-colors"
              >
                Browse latest <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/link:translate-x-0.5" />
              </Link>
            </div>
            <ProductCarousel>
              {newArrivals.map((prod) => (
                <div key={prod.id} className="w-[260px] shrink-0">
                  <ProductCard product={prod} showWishlistButton={false} />
                </div>
              ))}
            </ProductCarousel>
          </section>
        )}

        {/* Horizontal Scroll Carousel: Verified Creator Picks */}
        {verifiedPicks.length > 0 && (
          <section className="bg-white border border-zinc-200 rounded-[32px] p-6 md:p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-zinc-950 tracking-tight flex items-center gap-2">
                  Verified Creator Picks
                </h2>
                <p className="text-zinc-500 text-xs mt-1">Curated selection from verified and trusted storefront owners.</p>
              </div>
              <Link
                href="/"
                className="text-xs font-extrabold text-amber-600 hover:text-amber-700 flex items-center gap-1 group/link transition-colors"
              >
                Explore shops <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/link:translate-x-0.5" />
              </Link>
            </div>
            <ProductCarousel>
              {verifiedPicks.map((prod) => (
                <div key={prod.id} className="w-[260px] shrink-0">
                  <ProductCard product={prod} showWishlistButton={false} />
                </div>
              ))}
            </ProductCarousel>
          </section>
        )}

      </main>
    </div>
  );
}
