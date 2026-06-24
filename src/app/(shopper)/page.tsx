import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db';
import { ProductCard } from '@/components/shared/product-card';
import { ProductCarousel } from '@/components/shared/product-carousel';
import { HomepageSearch } from '@/components/shared/homepage-search';
import { ArrowRight, Heart, Check, CheckCircle, Sparkles, Users, Award, Shield, ShoppingBag, MessageSquare, Play } from 'lucide-react';
import { getCreatorPresentation, getProductBadges, getHeroReelStats } from '@/lib/demo';

import { auth } from '@/lib/auth';
import { MarketplaceClient } from './marketplace/marketplace-client';
import { searchProductIds, ProductSearchSort } from '@/backend/lib/search';
import { generateItemListJSONLD, safeJsonLdStringify } from '@/lib/seo';
import { RecentlyViewedStrip } from '@/components/shared/recently-viewed';
import { logger } from '@/backend/lib/logger';
import { Prisma } from '@prisma/client';
import { Button } from '@/components/ui/button';



// 7. Cached Query: Hero Featured Product (2 min TTL)
const getHeroFeaturedProduct = unstable_cache(
  async () => {
    const p = await db.product.findFirst({
      where: { slug: 'mystic-oud-eau-de-parfum', status: 'ACTIVE' },
      include: {
        images: { orderBy: { displayOrder: 'asc' }, take: 1 },
        shop: { select: { name: true, slug: true, isVerified: true, logo: true } },
      },
    });
    if (p) return p;
    return db.product.findFirst({
      where: { status: 'ACTIVE' },
      include: {
        images: { orderBy: { displayOrder: 'asc' }, take: 1 },
        shop: { select: { name: true, slug: true, isVerified: true, logo: true } },
      },
    });
  },
  ['homepage-hero-product'],
  { revalidate: 120, tags: ['homepage-hero-product'] }
);

// 8. Cached Query: Featured Creators (5 min TTL)
const getFeaturedCreators = unstable_cache(
  async () => {
    let shops = await db.shop.findMany({
      where: { isSuspended: false, isPaused: false, isVerified: true },
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
      take: 5,
    });
    if (shops.length < 5) {
      const extraShops = await db.shop.findMany({
        where: {
          isSuspended: false,
          isPaused: false,
          id: { notIn: shops.map((s) => s.id) },
        },
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
        take: 5 - shops.length,
      });
      shops = [...shops, ...extraShops];
    }
    return shops;
  },
  ['homepage-featured-creators'],
  { revalidate: 300, tags: ['homepage-featured-creators'] }
);

// 9. Cached Query: Trending Products (5 min TTL)
const getTrendingProducts = unstable_cache(
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
      take: 6,
    });
  },
  ['homepage-trending-products'],
  { revalidate: 300, tags: ['homepage-trending-products'] }
);

// 10. Cached Query: Recently Added Stores (5 min TTL)
const getRecentlyAddedStores = unstable_cache(
  async () => {
    return db.shop.findMany({
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
      orderBy: { createdAt: 'desc' },
      take: 6,
    });
  },
  ['homepage-recently-added-stores'],
  { revalidate: 300, tags: ['homepage-recently-added-stores'] }
);

// 11. Cached Query: Trending Categories (10 min TTL)
const getTrendingCategories = unstable_cache(
  async () => {
    const targetCategories = [
      { name: 'Oud Perfume', query: 'Oud' },
      { name: 'Silver Anklets', query: 'Anklet' },
      { name: 'Handmade Candles', query: 'Candle' },
      { name: 'Crochet Tote Bag', query: 'Bag' },
      { name: 'Aesthetic Wall Art', query: 'Art' },
      { name: 'Gold Plated Jewelry', query: 'Jewelry' },
      { name: 'Resin Art', query: 'Resin' },
    ];
    
    const results = [];
    const randomProduct = await db.product.findFirst({
      where: { status: 'ACTIVE' },
      select: { images: { select: { url: true }, take: 1 } },
    });
    
    for (const cat of targetCategories) {
      const product = await db.product.findFirst({
        where: {
          status: 'ACTIVE',
          OR: [
            { category: { contains: cat.query, mode: 'insensitive' } },
            { title: { contains: cat.query, mode: 'insensitive' } },
            { description: { contains: cat.query, mode: 'insensitive' } },
          ]
        },
        select: { images: { select: { url: true }, take: 1 } },
      });
      
      results.push({
        name: cat.name,
        query: cat.query,
        image: product?.images[0]?.url || randomProduct?.images[0]?.url || null,
      });
    }
    return results;
  },
  ['homepage-trending-categories'],
  { revalidate: 600, tags: ['homepage-trending-categories'] }
);

// 12. Cached Query: Just Discovered (Unexpected mixed feed, 5 min TTL)
const getJustDiscovered = unstable_cache(
  async () => {
    return db.product.findMany({
      where: {
        status: 'ACTIVE',
        shop: { isSuspended: false, isPaused: false },
      },
      include: {
        images: { orderBy: { displayOrder: 'asc' }, take: 1 },
        shop: { select: { id: true, name: true, slug: true, city: true, isVerified: true, averageRating: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  },
  ['homepage-just-discovered-v2'],
  { revalidate: 300, tags: ['homepage-just-discovered-v2'] }
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

  // --- CASE B: Refined Luxury Storytelling Homepage ---
  // Execute database fetches in parallel
  const [
    heroProduct,
    featuredCreators,
    trendingProducts,
    recentlyAddedStores,
    trendingCategories,
    justDiscoveredRaw,
  ] = await Promise.all([
    getHeroFeaturedProduct(),
    getFeaturedCreators(),
    getTrendingProducts(),
    getRecentlyAddedStores(),
    getTrendingCategories(),
    getJustDiscovered(),
  ]);

  // Extract exactly 5 items for the "Just Discovered" feed
  const justDiscovered = justDiscoveredRaw.slice(0, 5);

  // Safe fallback values for featured Hero product
  const heroImage = heroProduct?.images?.[0]?.url || '';
  const heroTitle = heroProduct?.title || 'Oud Filtra';
  const heroPrice = heroProduct?.price || 2499;
  const heroShopName = heroProduct?.shop?.name || 'Aura Scents';
  const heroProductUrl = heroProduct ? `/store/${heroProduct.shop.slug}/${heroProduct.slug}` : '#';

  // Get Hero reel stats from the Demo Data Service
  const heroStats = getHeroReelStats();

  const suggestionTags = [
    { name: 'Oud Perfume', query: 'Oud' },
    { name: 'Silver Jewelry', query: 'Silver' },
    { name: 'Crochet Bags', query: 'Bag' },
    { name: 'Home Decor', query: 'Decor' },
    { name: 'Aesthetic Posters', query: 'Poster' }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#FAF8F5] text-[#1A1A18] antialiased pb-16">
      {/* 1. Hero Section */}
      <section className="relative overflow-hidden pt-8 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {/* Background decorative glow */}
        <div className="absolute top-12 left-1/4 w-[300px] h-[300px] rounded-full bg-[#A77F3A]/5 blur-[100px] -z-10" />
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center w-full">
          {/* Left Column: Text, Search, Popular searches */}
          <div className="lg:col-span-7 flex flex-col text-left">
            <h1 className="font-serif text-4xl sm:text-5xl md:text-[56px] font-bold tracking-tight text-[#1A1A18] leading-[1.1] mb-6">
              Your favorite Instagram stores.<br />
              Finally searchable.
            </h1>
            <p className="text-zinc-550 text-sm md:text-base font-medium max-w-lg mb-8 leading-relaxed">
              Seyon is the catalog layer for social commerce. Stop digging through comments, highlights, and DMs. We organize independent creators, designers, and small businesses in one beautiful, searchable catalog.
            </p>

            <div className="w-full mb-6">
              <HomepageSearch />
            </div>

            {/* Quick Suggestions tags */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs mb-6">
              <span className="font-semibold text-zinc-400">Popular right now:</span>
              {suggestionTags.map((tag) => (
                <Link
                  key={tag.name}
                  href={`/?q=${encodeURIComponent(tag.query)}`}
                  className="px-3.5 py-1.5 bg-white hover:bg-zinc-50 border border-zinc-200 hover:border-[#A77F3A]/50 text-zinc-700 hover:text-[#A77F3A] rounded-full text-xs font-semibold transition-all duration-300 shadow-2xs cursor-pointer select-none active:scale-95"
                >
                  {tag.name}
                </Link>
              ))}
            </div>

            {/* Premium tagline clarifying platform purpose */}
            <div className="pt-5 border-t border-zinc-200/70 max-w-xl">
              <p className="text-zinc-700 text-xs sm:text-sm font-semibold tracking-wide flex items-center gap-2.5">
                <Sparkles className="h-4.5 w-4.5 text-[#A77F3A] shrink-0" />
                Browse beautifully organized catalogs from creators who sell on Instagram, WhatsApp, Telegram & YouTube.
              </p>
            </div>
          </div>

          {/* Right Column: Layered Premium Reels-to-Seyon CSS Phone Flow */}
          <div className="lg:col-span-5 relative flex justify-center items-center h-[520px] lg:h-[550px] w-full mt-8 lg:mt-0">
            {/* Phone 1: Instagram Reel Mockup (The Social Layer) */}
            <div className="relative w-[240px] h-[450px] bg-black rounded-[2.8rem] border-[7px] border-zinc-900 shadow-2xl overflow-hidden shrink-0 transform -translate-x-14 -rotate-4 hover:-rotate-1 transition-transform duration-500 z-0 select-none">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-3.5 bg-zinc-900 rounded-b-xl z-20" />
              
              {heroImage ? (
                <Image
                  src={heroImage}
                  alt="Social Media Reel content"
                  fill
                  className="object-cover brightness-[90%]"
                  sizes="240px"
                  priority
                />
              ) : (
                <div className="w-full h-full bg-zinc-950 flex items-center justify-center text-zinc-650">Reel Video</div>
              )}
              
              {/* Instagram Reel UI overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 flex flex-col justify-between p-3.5 z-10 text-white font-sans">
                <div className="flex items-center justify-between mt-2.5 text-[9px] font-bold tracking-wide">
                  <span className="bg-white/10 px-2 py-0.5 rounded-full backdrop-blur-md">Reels</span>
                  <Play className="h-3.5 w-3.5 fill-white text-white opacity-80" />
                </div>

                <div className="flex flex-col w-full gap-3">
                  {/* Floating "DM to Order" / Link Tag */}
                  <div className="self-center bg-[#A77F3A] border border-white/20 text-white text-[10px] font-black uppercase tracking-wider px-3.5 py-2 rounded-xl shadow-lg animate-bounce flex items-center gap-1">
                    <MessageSquare className="h-3 w-3 fill-white" /> DM to Order
                  </div>

                  <div className="flex justify-between items-end gap-1 w-full">
                    <div className="flex flex-col text-left max-w-[75%]">
                      <div className="flex items-center gap-1 mb-1">
                        <div className="h-5 w-5 rounded-full bg-amber-100 border border-white/20 flex items-center justify-center text-[8px] font-bold text-amber-700 overflow-hidden">
                          {heroShopName[0].toUpperCase()}
                        </div>
                        <span className="text-[10px] font-bold truncate">{heroShopName.toLowerCase()}</span>
                      </div>
                      <p className="text-[9px] text-zinc-200 line-clamp-2 leading-snug font-medium">
                        Oud that stays with you ✨ Comment &ldquo;LINK&rdquo; to get catalog. #socialcommerce
                      </p>
                    </div>

                    <div className="flex flex-col gap-2.5 items-center text-white pb-1">
                      <div className="flex flex-col items-center">
                        <Heart className="h-4 w-4 text-white fill-white" />
                        <span className="text-[8px] font-bold mt-0.5">{heroStats.likes}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <MessageSquare className="h-4 w-4 text-white fill-white" />
                        <span className="text-[8px] font-bold mt-0.5">{heroStats.comments}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <ArrowRight className="h-4 w-4 text-white rotate-45" />
                        <span className="text-[8px] font-bold mt-0.5">{heroStats.shares}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Connective Arrow */}
            <svg
              className="absolute top-[28%] right-[125px] w-24 h-24 pointer-events-none z-15 hidden sm:block"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M10 80 Q 40 10 90 40"
                stroke="#A77F3A"
                strokeWidth="2.5"
                strokeDasharray="5 5"
                strokeLinecap="round"
              />
              <path
                d="M 90 40 L 80 34 M 90 40 L 85 50"
                stroke="#A77F3A"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>

            {/* Phone 2: Overlapping Seyon Catalog Listing (The Organized Layer) */}
            <Link
              href={heroProductUrl}
              className="absolute top-1/4 right-2 sm:-right-6 w-[205px] bg-white/95 backdrop-blur-md rounded-[2.5rem] p-4 shadow-2xl border border-zinc-200/50 z-20 hover:scale-103 hover:-translate-y-0.5 transition-all duration-300 group flex flex-col cursor-pointer select-none"
            >
              <div className="relative aspect-square w-full rounded-2xl bg-zinc-50 border border-zinc-150 overflow-hidden mb-3">
                {heroImage ? (
                  <Image
                    src={heroImage}
                    alt={heroTitle}
                    fill
                    className="object-cover"
                    sizes="180px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-zinc-400">No Image</div>
                )}
                <span className="absolute top-2.5 left-2.5 z-10 gold-pill-badge text-[8px] px-2 py-0.5 rounded-md leading-none font-bold uppercase tracking-wider shadow-sm">
                  Seyon Catalog
                </span>
              </div>
              <div className="flex flex-col text-left">
                {/* Rating element */}
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-[9px] font-extrabold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 uppercase tracking-wide flex items-center gap-0.5 leading-none">
                    ⭐ 4.9 <span className="text-zinc-400 font-medium normal-case">(124)</span>
                  </span>
                </div>
                
                <span className="text-xs font-bold text-zinc-950 leading-snug truncate group-hover:text-[#A77F3A] transition-colors">
                  {heroTitle}
                </span>
                <span className="text-[10px] text-zinc-400 font-semibold mt-0.5">
                  by {heroShopName}
                </span>
                
                {/* Variants dots */}
                <div className="flex items-center gap-1 mt-2">
                  <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider mr-1">Variants:</span>
                  <span className="h-2 w-2 rounded-full bg-[#1A1A18] border border-white" />
                  <span className="h-2 w-2 rounded-full bg-[#A77F3A] border border-white" />
                  <span className="h-2 w-2 rounded-full bg-[#E7E2D8] border border-white" />
                </div>

                <span className="text-sm font-black text-[#1A1A18] mt-2.5 flex items-baseline gap-1">
                  ₹{heroPrice.toFixed(0)}
                  <span className="text-[9px] text-zinc-400 font-semibold line-through">₹{(heroPrice * 1.3).toFixed(0)}</span>
                </span>
              </div>
              
              {/* WhatsApp direct buy button */}
              <button className="w-full mt-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-extrabold uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-1 border-none cursor-pointer select-none">
                <span className="h-2 w-2 rounded-full bg-white animate-ping mr-0.5" />
                Connect on WhatsApp
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. "Why Seyon?" Comparison Block (Repositioned immediately below Hero) */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full mb-16">
        <div className="bg-white border border-[#F0ECE3] rounded-[40px] p-8 md:p-12 shadow-xs">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left Column */}
            <div className="lg:col-span-4 flex flex-col text-left">
              <span className="text-xs font-extrabold uppercase tracking-widest text-[#A77F3A] flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-[#A77F3A] fill-[#A77F3A]" /> Why Seyon?
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-zinc-900 mt-2.5 mb-6 leading-tight">
                Because finding the<br className="hidden md:block" />
                right product shouldn&apos;t<br className="hidden md:block" />
                be this hard.
              </h2>
              <Link href="/">
                <button className="px-7 py-3 bg-[#1A1A18] hover:bg-[#A77F3A] text-white text-xs font-extrabold uppercase tracking-wider rounded-full shadow-md transition-all inline-block text-center cursor-pointer select-none active:scale-95 shrink-0 border-none">
                  Learn More
                </button>
              </Link>
            </div>

            {/* Right Column: Side-by-side comparison panels */}
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-11 gap-4 items-center">
              {/* Buying on Social Media (pain points) */}
              <div className="sm:col-span-5 bg-[#FAF8F5] border border-[#E7E2D8]/40 rounded-[28px] p-6 shadow-2xs text-left h-full">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Buying via</span>
                <h3 className="text-base font-black text-zinc-900 mt-0.5 mb-4">Social Media</h3>
                
                <ul className="flex flex-col gap-3 text-xs text-zinc-600 font-medium">
                  <li className="flex items-start gap-2.5">
                    <span className="h-4.5 w-4.5 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5 leading-none">✕</span>
                    <span>Scroll through hundreds of reels to find products</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="h-4.5 w-4.5 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5 leading-none">✕</span>
                    <span>Hunt captions and highlights for basic sizing & pricing</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="h-4.5 w-4.5 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5 leading-none">✕</span>
                    <span>DM to order and wait hours or days for responses</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="h-4.5 w-4.5 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5 leading-none">✕</span>
                    <span>Lose the creator profile and never find them again</span>
                  </li>
                </ul>
              </div>

              {/* Gold Separator Arrow */}
              <div className="sm:col-span-1 flex items-center justify-center w-10 h-10 rounded-full bg-[#A77F3A]/10 border border-[#A77F3A]/20 text-[#A77F3A] shrink-0 mx-auto lg:my-0 lg:rotate-0 rotate-90 my-2 shadow-2xs">
                <ArrowRight className="h-4.5 w-4.5" />
              </div>

              {/* Buying on Seyon (clean catalog) */}
              <div className="sm:col-span-5 bg-white border border-[#A77F3A]/15 rounded-[28px] p-6 shadow-xs text-left ring-2 ring-[#A77F3A]/5 h-full">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#A77F3A]">Buying via</span>
                <h3 className="text-base font-black text-[#A77F3A] mt-0.5 mb-4">Seyon Catalog</h3>
                
                <ul className="flex flex-col gap-3 text-xs text-zinc-700 font-medium">
                  <li className="flex items-start gap-2.5">
                    <span className="h-4.5 w-4.5 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5 leading-none"><Check className="h-3 w-3 stroke-[3]" /></span>
                    <span className="font-semibold text-zinc-900">Search exactly what you want across multiple platforms</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="h-4.5 w-4.5 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5 leading-none"><Check className="h-3 w-3 stroke-[3]" /></span>
                    <span className="font-semibold text-zinc-900">Instantly find verified, trustworthy creator storefronts</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="h-4.5 w-4.5 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5 leading-none"><Check className="h-3 w-3 stroke-[3]" /></span>
                    <span className="font-semibold text-zinc-900">View complete specifications, details & pricing in one view</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="h-4.5 w-4.5 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5 leading-none"><Check className="h-3 w-3 stroke-[3]" /></span>
                    <span className="font-semibold text-zinc-900">Click to DM and place order instantly via WhatsApp</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Benefits Bar */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full mb-16">
        <div className="bg-[#FCFBF9] border border-[#F0ECE3] rounded-3xl p-6 shadow-2xs">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-y-6 gap-x-4 justify-items-center text-center">
            <div className="flex flex-col items-center max-w-[180px]">
              <div className="flex items-center gap-1.5 mb-2.5 shrink-0">
                <span className="h-6 w-6 rounded-md bg-pink-500/10 text-pink-600 flex items-center justify-center font-bold text-[10px]">IG</span>
                <span className="h-6 w-6 rounded-md bg-green-500/10 text-green-600 flex items-center justify-center font-bold text-[10px]">WA</span>
                <span className="h-6 w-6 rounded-md bg-sky-500/10 text-sky-600 flex items-center justify-center font-bold text-[10px]">TG</span>
              </div>
              <h4 className="text-xs font-extrabold text-zinc-900 leading-tight">Products Sourced From</h4>
              <p className="text-[10px] text-zinc-450 mt-1 leading-normal font-semibold">Instagram, WhatsApp, Telegram & YouTube socials</p>
            </div>
            
            <div className="flex flex-col items-center max-w-[180px]">
              <div className="h-8 w-8 rounded-full bg-[#A77F3A]/10 text-[#A77F3A] flex items-center justify-center mb-2.5 shrink-0">
                <MessageSquare className="h-4.5 w-4.5" />
              </div>
              <h4 className="text-xs font-extrabold text-zinc-900 leading-tight">DM to Order</h4>
              <p className="text-[10px] text-zinc-450 mt-1 leading-normal font-semibold">Connect & chat directly with creators on WhatsApp</p>
            </div>

            <div className="flex flex-col items-center max-w-[180px]">
              <div className="h-8 w-8 rounded-full bg-[#A77F3A]/10 text-[#A77F3A] flex items-center justify-center mb-2.5 shrink-0">
                <ArrowRight className="h-4.5 w-4.5 rotate-45" />
              </div>
              <h4 className="text-xs font-extrabold text-zinc-900 leading-tight">No Middlemen</h4>
              <p className="text-[10px] text-zinc-450 mt-1 leading-normal font-semibold">Buy straight from source with zero transaction fees</p>
            </div>

            <div className="flex flex-col items-center max-w-[180px]">
              <div className="h-8 w-8 rounded-full bg-[#A77F3A]/10 text-[#A77F3A] flex items-center justify-center mb-2.5 shrink-0">
                <Users className="h-4.5 w-4.5" />
              </div>
              <h4 className="text-xs font-extrabold text-zinc-900 leading-tight">Support Small</h4>
              <p className="text-[10px] text-zinc-450 mt-1 leading-normal font-semibold">Empower independent creators & small businesses</p>
            </div>

            <div className="flex flex-col items-center max-w-[180px]">
              <div className="h-8 w-8 rounded-full bg-[#A77F3A]/10 text-[#A77F3A] flex items-center justify-center mb-2.5 shrink-0">
                <CheckCircle className="h-4.5 w-4.5" />
              </div>
              <h4 className="text-xs font-extrabold text-zinc-900 leading-tight">Trusted Listings</h4>
              <p className="text-[10px] text-zinc-450 mt-1 leading-normal font-semibold">100% verified merchant profiles & genuine creations</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Trending Across Creators (Circle Category Cards) */}
      {trendingCategories.length > 0 && (
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full mb-16">
          <div className="flex items-center justify-between mb-6 pb-2 border-b border-zinc-200">
            <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
              Trending Across Creators
            </h2>
            <Link
              href="/"
              className="text-xs font-extrabold text-[#A77F3A] hover:text-[#916b2f] flex items-center gap-1 transition-colors"
            >
              View all categories &rarr;
            </Link>
          </div>
          
          <div className="flex items-start overflow-x-auto gap-6 no-scrollbar py-3 scroll-smooth">
            {trendingCategories.map((cat) => (
              <Link
                key={cat.name}
                href={`/?q=${encodeURIComponent(cat.query)}`}
                className="group flex flex-col items-center shrink-0 cursor-pointer select-none"
              >
                <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden border-2 border-white shadow-md group-hover:scale-105 transition-transform duration-300 bg-zinc-50 shrink-0">
                  {cat.image ? (
                    <Image
                      src={cat.image}
                      alt={cat.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="130px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-zinc-400 font-semibold bg-zinc-100 text-zinc-500 uppercase">{cat.name[0]}</div>
                  )}
                  <div className="absolute bottom-1.5 right-1.5 bg-[#A77F3A] text-white rounded-full p-1 border border-white flex items-center justify-center shadow-md leading-none">
                    <Check className="h-3 w-3 text-white stroke-[3.5]" />
                  </div>
                </div>
                <span className="text-xs sm:text-sm font-bold text-zinc-900 mt-3 text-center leading-tight max-w-[110px] group-hover:text-[#A77F3A] transition-colors">
                  {cat.name}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 5. ✨ Just Discovered (Discovery Feed of Mixed Category Gems) */}
      {justDiscovered.length > 0 && (
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full mb-16">
          <div className="flex flex-col text-left mb-6 pb-2 border-b border-zinc-200">
            <span className="text-xs font-extrabold uppercase tracking-widest text-[#A77F3A] mb-1">Addictive Finds</span>
            <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
              ✨ Just Discovered
            </h2>
            <p className="text-xs text-zinc-400 font-semibold mt-0.5">Uncover independent designers, creators, and hidden gems across India.</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {justDiscovered.map((prod) => {
              const presentation = getCreatorPresentation(prod.shop);
              const bgImg = prod.images?.[0]?.url || '';
              return (
                <Link
                  key={prod.id}
                  href={`/store/${prod.shop.slug}/${prod.slug}`}
                  className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-2xs hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group flex flex-col h-full cursor-pointer select-none text-left"
                >
                  <div className="relative aspect-[4/3] w-full bg-zinc-50 border-b border-zinc-100 overflow-hidden">
                    {bgImg ? (
                      <Image
                        src={bgImg}
                        alt={prod.title}
                        fill
                        className="object-cover group-hover:scale-103 transition-transform duration-300"
                        sizes="240px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-zinc-400">No Image</div>
                    )}
                    <span className="absolute top-2.5 left-2.5 bg-black/60 text-white text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md backdrop-blur-xs">
                      {prod.category}
                    </span>
                  </div>
                  <div className="p-4 flex flex-col flex-1 justify-between">
                    <div>
                      <span className="text-[10px] text-[#A77F3A] font-bold uppercase tracking-wide">
                        {presentation.location}
                      </span>
                      <h3 className="font-serif text-sm font-bold text-zinc-900 mt-0.5 leading-tight line-clamp-2 group-hover:text-[#A77F3A] transition-colors">
                        {prod.title}
                      </h3>
                      <p className="text-[10px] text-zinc-400 font-semibold mt-1">
                        by {prod.shop.name}
                      </p>
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-100">
                      <span className="text-xs font-black text-zinc-900">
                        ₹{prod.price.toFixed(0)}
                      </span>
                      <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 uppercase tracking-wider">
                        ⭐ {presentation.rating.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* 6. Featured Creators (Enriched with ratings, locations, and stable order counts) */}
      {featuredCreators.length > 0 && (
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full mb-16">
          <div className="flex items-center justify-between mb-6 pb-2 border-b border-zinc-200">
            <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
              Featured Creators
            </h2>
            <Link
              href="/"
              className="text-xs font-extrabold text-[#A77F3A] hover:text-[#916b2f] flex items-center gap-1 transition-colors"
            >
              View all creators &rarr;
            </Link>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {featuredCreators.map((shop) => {
              const bgProdImg = shop.products?.[0]?.images?.[0]?.url || '';
              const presentation = getCreatorPresentation(shop);
              return (
                <div
                  key={shop.slug}
                  className="relative aspect-[3/4] rounded-3xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500 group select-none flex flex-col justify-between p-5 text-left"
                >
                  {bgProdImg ? (
                    <Image
                      src={bgProdImg}
                      alt={`${shop.name} background`}
                      fill
                      className="object-cover brightness-[60%] group-hover:scale-105 transition-transform duration-500 -z-10"
                      sizes="240px"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[#E7E2D8] -z-10" />
                  )}
                  
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent -z-5" />
                  
                  {/* Top: Location Badge */}
                  <div className="self-start flex flex-col gap-1">
                    <span className="text-[8px] font-extrabold text-zinc-300 uppercase tracking-wider bg-black/40 border border-white/10 px-2.5 py-1 rounded-full backdrop-blur-md">
                      {presentation.location}
                    </span>
                  </div>

                  {/* Bottom: Details & Button */}
                  <div className="flex flex-col text-left text-white mt-auto">
                    {/* Rating and orders */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-1.5 text-[9px] font-extrabold">
                      <span className="bg-emerald-600/90 border border-emerald-500/30 px-1.5 py-0.5 rounded flex items-center gap-0.5 leading-none">
                        ⭐ {presentation.rating.toFixed(1)}
                      </span>
                      <span className="bg-white/15 px-2 py-0.5 rounded tracking-wide font-bold uppercase backdrop-blur-xs text-zinc-200">
                        {presentation.trustTag}
                      </span>
                    </div>

                    <h3 className="font-serif text-lg font-bold flex items-center gap-1 leading-tight group-hover:text-amber-400 transition-colors">
                      {shop.name}
                      {shop.isVerified && (
                        <span className="bg-emerald-500 text-white rounded-full p-0.5 leading-none scale-85">
                          <Check className="h-2 w-2 text-white stroke-[4]" />
                        </span>
                      )}
                    </h3>
                    
                    <span className="text-[10px] text-zinc-300 mt-1 uppercase tracking-wide font-semibold truncate max-w-full">
                      {shop._count.products} Products in catalog
                    </span>

                    <Link
                      href={`/store/${shop.slug}`}
                      className="w-full mt-4 py-2.5 bg-white/10 hover:bg-white text-white hover:text-black font-extrabold text-[10px] uppercase tracking-wider rounded-xl border border-white/20 hover:border-white transition-all text-center block shadow-xs select-none active:scale-97 cursor-pointer"
                    >
                      Visit Store
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 7. Trending This Week (Enriched with viral and social proof tags) */}
      {trendingProducts.length > 0 && (
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full mb-16">
          <div className="flex items-center justify-between mb-6 pb-2 border-b border-zinc-200">
            <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
              Trending This Week
            </h2>
            <Link
              href="/"
              className="text-xs font-extrabold text-[#A77F3A] hover:text-[#916b2f] flex items-center gap-1 transition-colors"
            >
              View all products &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 justify-items-center w-full">
            {trendingProducts.map((prod) => {
              const badges = getProductBadges(prod.id);
              const primaryBadge = badges[0] || 'Trending';
              return (
                <div key={prod.id} className="relative group flex flex-col text-left w-full">
                  <ProductCard
                    key={prod.id}
                    product={prod}
                    showWishlistButton={false}
                  />
                  {/* Elegant Social Proof Badge under product card */}
                  <div className="mt-2.5 self-start">
                    <span className="text-[8px] font-extrabold text-[#A77F3A] bg-[#A77F3A]/5 px-2.5 py-1 rounded-md border border-[#A77F3A]/15 uppercase tracking-wider leading-none">
                      ✔ {primaryBadge}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 8. Curated Editorial Collections */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full mb-16">
        <div className="flex items-center justify-between mb-6 pb-2 border-b border-zinc-200">
          <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
            Curated Collections
          </h2>
          <Link
            href="/"
            className="text-xs font-extrabold text-[#A77F3A] hover:text-[#916b2f] flex items-center gap-1 transition-colors"
          >
            Explore all collections &rarr;
          </Link>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Collection 1: Wedding Gifts */}
          <Link
            href="/?q=Gift"
            className="relative h-[245px] rounded-[30px] overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-500 group cursor-pointer select-none"
          >
            <Image
              src="/images/cat-oud.jpg"
              alt="Wedding Gifts Collection"
              fill
              className="object-cover brightness-70 group-hover:scale-105 transition-transform duration-500 -z-10"
              sizes="300px"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#A77F3A]/20 to-[#1A1A18]/90 -z-9" />
            <div className="absolute inset-0 p-6 flex flex-col justify-between text-left text-white h-full">
              <h3 className="font-serif text-2xl font-bold leading-tight max-w-[160px] tracking-tight">
                Wedding<br />Gifts
              </h3>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-white group-hover:text-amber-400 transition-colors flex items-center gap-1 mt-auto">
                Explore <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>

          {/* Collection 2: Minimal Homes */}
          <Link
            href="/?q=Decor"
            className="relative h-[245px] rounded-[30px] overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-500 group cursor-pointer select-none"
          >
            <Image
              src="/images/cat-crochet.jpg"
              alt="Minimal Homes Collection"
              fill
              className="object-cover brightness-70 group-hover:scale-105 transition-transform duration-500 -z-10"
              sizes="300px"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-700/20 to-zinc-950/95 -z-9" />
            <div className="absolute inset-0 p-6 flex flex-col justify-between text-left text-white h-full">
              <h3 className="font-serif text-2xl font-bold leading-tight max-w-[160px] tracking-tight">
                Minimal<br />Homes
              </h3>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-white group-hover:text-amber-400 transition-colors flex items-center gap-1 mt-auto">
                Explore <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>

          {/* Collection 3: Trending on Instagram */}
          <Link
            href="/?q=Viral"
            className="relative h-[245px] rounded-[30px] overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-500 group cursor-pointer select-none"
          >
            <Image
              src="/images/cat-art.jpg"
              alt="Trending on Instagram Collection"
              fill
              className="object-cover brightness-70 group-hover:scale-105 transition-transform duration-500 -z-10"
              sizes="300px"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-stone-600/20 to-stone-950/95 -z-9" />
            <div className="absolute inset-0 p-6 flex flex-col justify-between text-left text-white h-full">
              <h3 className="font-serif text-2xl font-bold leading-tight max-w-[160px] tracking-tight">
                Trending on<br />Instagram
              </h3>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-white group-hover:text-amber-400 transition-colors flex items-center gap-1 mt-auto">
                Explore <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>

          {/* Collection 4: Made in India */}
          <Link
            href="/?q=Handmade"
            className="relative h-[245px] rounded-[30px] overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-500 group cursor-pointer select-none"
          >
            <Image
              src="/images/cat-candles.jpg"
              alt="Made in India Collection"
              fill
              className="object-cover brightness-70 group-hover:scale-105 transition-transform duration-500 -z-10"
              sizes="300px"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#9B702B]/20 to-neutral-950/95 -z-9" />
            <div className="absolute inset-0 p-6 flex flex-col justify-between text-left text-white h-full">
              <h3 className="font-serif text-2xl font-bold leading-tight max-w-[160px] tracking-tight">
                Made in<br />India
              </h3>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-white group-hover:text-amber-400 transition-colors flex items-center gap-1 mt-auto">
                Explore <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>
        </div>
      </section>

      {/* 9. New Creators This Week (Formerly Recently Added Stores, humanized) */}
      {recentlyAddedStores.length > 0 && (
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full mb-16">
          <div className="flex items-center justify-between mb-6 pb-2 border-b border-zinc-200">
            <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
              New Creators This Week
            </h2>
            <Link
              href="/"
              className="text-xs font-extrabold text-[#A77F3A] hover:text-[#916b2f] flex items-center gap-1 transition-colors"
            >
              View all stores &rarr;
            </Link>
          </div>

          <ProductCarousel>
            {recentlyAddedStores.map((shop) => {
              const presentation = getCreatorPresentation(shop);
              return (
                <div key={shop.slug} className="px-1 py-2">
                  <div className="flex flex-col items-center bg-white border border-zinc-150 rounded-[2rem] p-6 w-[210px] shrink-0 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-350 text-center select-none group h-[265px] justify-between">
                    <div className="relative w-20 h-20 rounded-full overflow-hidden bg-zinc-50 border border-zinc-150 flex items-center justify-center mb-3 group-hover:scale-103 transition-transform">
                      {shop.logo ? (
                        <Image
                          src={shop.logo}
                          alt={shop.name}
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-lg font-bold text-amber-700 uppercase">
                          {shop.name[0]}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col items-center w-full min-w-0">
                      <h3 className="font-serif text-base font-bold text-zinc-950 truncate max-w-full leading-tight group-hover:text-[#A77F3A] transition-colors">
                        {shop.name}
                      </h3>
                      <span className="text-[9px] text-[#A77F3A] mt-1 uppercase tracking-wider font-extrabold flex items-center gap-0.5">
                        ⭐ {presentation.rating.toFixed(1)} <span className="text-zinc-300 font-medium font-sans">|</span> {presentation.location}
                      </span>
                      <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider mt-2.5 bg-zinc-50 border border-zinc-100 px-2.5 py-0.5 rounded-full">
                        {shop._count.products} Listings
                      </span>
                    </div>

                    <Link
                      href={`/store/${shop.slug}`}
                      className="mt-4 px-5 py-2 bg-zinc-50 hover:bg-[#1A1A18] text-zinc-800 hover:text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl border border-zinc-200 hover:border-[#1A1A18] transition-all w-full text-center block shadow-2xs select-none active:scale-97 cursor-pointer"
                    >
                      Visit Store
                    </Link>
                  </div>
                </div>
              );
            })}
          </ProductCarousel>
        </section>
      )}

      {/* 10. From Reels to Reality (Explain Seyon value in 3 concrete flows) */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full mb-16">
        <div className="bg-[#FAF6F0]/60 border border-[#F0ECE3] rounded-[40px] p-8 md:p-12 text-center">
          <div className="max-w-xl mx-auto mb-10">
            <span className="text-xs font-extrabold uppercase tracking-widest text-[#A77F3A]">Platform Flow</span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 mt-2 mb-3">
              From Reels to Reality
            </h2>
            <p className="text-sm text-zinc-450 font-semibold leading-relaxed">
              &ldquo;I saw it on social. Now I can actually search, filter, and buy it in seconds.&rdquo;
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Flow 1 */}
            <div className="flex flex-col items-center bg-white rounded-3xl p-6 border border-zinc-150 shadow-2xs">
              <div className="flex items-center gap-3 w-full justify-center">
                <div className="w-14 h-18 bg-zinc-100 rounded-lg relative overflow-hidden shrink-0 border border-zinc-200">
                  <span className="absolute inset-0 bg-black/30 flex items-center justify-center text-white text-[9px] font-bold">📱 IG Reel</span>
                </div>
                <div className="text-zinc-400 font-bold">&rarr;</div>
                <div className="w-14 h-18 bg-amber-50 rounded-lg relative overflow-hidden shrink-0 border border-amber-100 flex items-center justify-center text-[9px] font-extrabold text-[#A77F3A]">
                  🛒 Seyon
                </div>
              </div>
              <h3 className="font-serif text-sm font-bold text-zinc-900 mt-5">Pastel Crochet Bags</h3>
              <p className="text-[10px] text-zinc-450 mt-1.5 leading-relaxed font-semibold">
                Saw a dynamic reel of pastel bags but couldn&apos;t find the link in comments? Found the exact cotton tote catalog listing on Seyon, shipped directly from a Kerala creator.
              </p>
            </div>

            {/* Flow 2 */}
            <div className="flex flex-col items-center bg-white rounded-3xl p-6 border border-zinc-150 shadow-2xs">
              <div className="flex items-center gap-3 w-full justify-center">
                <div className="w-14 h-18 bg-zinc-100 rounded-lg relative overflow-hidden shrink-0 border border-zinc-200">
                  <span className="absolute inset-0 bg-black/30 flex items-center justify-center text-white text-[9px] font-bold">📱 YouTube</span>
                </div>
                <div className="text-zinc-400 font-bold">&rarr;</div>
                <div className="w-14 h-18 bg-amber-50 rounded-lg relative overflow-hidden shrink-0 border border-amber-100 flex items-center justify-center text-[9px] font-extrabold text-[#A77F3A]">
                  🛒 Seyon
                </div>
              </div>
              <h3 className="font-serif text-sm font-bold text-zinc-900 mt-5">Amber Oud Fragrance</h3>
              <p className="text-[10px] text-zinc-450 mt-1.5 leading-relaxed font-semibold">
                Heard a perfume recommendation in an aesthetic shorts vlog? Found their storefront in one click, compared variant concentrations, and placed a direct WhatsApp order.
              </p>
            </div>

            {/* Flow 3 */}
            <div className="flex flex-col items-center bg-white rounded-3xl p-6 border border-zinc-150 shadow-2xs">
              <div className="flex items-center gap-3 w-full justify-center">
                <div className="w-14 h-18 bg-zinc-100 rounded-lg relative overflow-hidden shrink-0 border border-zinc-200">
                  <span className="absolute inset-0 bg-black/30 flex items-center justify-center text-white text-[9px] font-bold">📱 Telegram</span>
                </div>
                <div className="text-zinc-400 font-bold">&rarr;</div>
                <div className="w-14 h-18 bg-amber-50 rounded-lg relative overflow-hidden shrink-0 border border-amber-100 flex items-center justify-center text-[9px] font-extrabold text-[#A77F3A]">
                  🛒 Seyon
                </div>
              </div>
              <h3 className="font-serif text-sm font-bold text-zinc-900 mt-5">Aesthetic Soy Candles</h3>
              <p className="text-[10px] text-zinc-450 mt-1.5 leading-relaxed font-semibold">
                Saved a channel photo of hand-poured geometric wax candles? Search &ldquo;Candle&rdquo; on Seyon to discover verified boutique makers across Jaipur and Bangalore.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 11. Trust Features Banner */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full mb-16">
        <div className="bg-[#FAF6F0] rounded-[32px] p-6 shadow-2xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-y-6 gap-x-4 justify-items-center text-center py-2">
            <div className="flex items-center gap-3 text-left max-w-[240px]">
              <div className="h-9 w-9 rounded-full bg-[#A77F3A]/10 text-[#A77F3A] flex items-center justify-center shrink-0 shadow-2xs">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-zinc-900 leading-tight">Verified Creators</h4>
                <p className="text-[10px] text-zinc-400 leading-snug font-semibold mt-0.5">Trusted & verified merchant profiles only</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-left max-w-[240px]">
              <div className="h-9 w-9 rounded-full bg-[#A77F3A]/10 text-[#A77F3A] flex items-center justify-center shrink-0 shadow-2xs">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-zinc-900 leading-tight">Direct Communication</h4>
                <p className="text-[10px] text-zinc-400 leading-snug font-semibold mt-0.5">Connect & chat directly on WhatsApp instantly</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-left max-w-[240px]">
              <div className="h-9 w-9 rounded-full bg-[#A77F3A]/10 text-[#A77F3A] flex items-center justify-center shrink-0 shadow-2xs">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-zinc-900 leading-tight">Secure & Safe</h4>
                <p className="text-[10px] text-zinc-400 leading-snug font-semibold mt-0.5">Shop with complete peace of mind & privacy</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-left max-w-[240px]">
              <div className="h-9 w-9 rounded-full bg-[#A77F3A]/10 text-[#A77F3A] flex items-center justify-center shrink-0 shadow-2xs">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-zinc-900 leading-tight">Growing Community</h4>
                <p className="text-[10px] text-zinc-400 leading-snug font-semibold mt-0.5">Join thousands of happy buyers & designers</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 12. Footer Seller Sign-up CTA Banner */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="bg-[#1A1A18] text-white rounded-[2rem] p-8 md:p-12 flex flex-col md:flex-row items-center justify-between relative overflow-hidden text-center md:text-left shadow-xl">
          <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#A77F3A]/20 blur-[90px] pointer-events-none" />
          
          <div className="flex flex-col z-10 text-left max-w-xl">
            <span className="text-xs font-extrabold text-[#A77F3A] uppercase tracking-widest mb-1.5">The Catalog Layer for Social Commerce</span>
            <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-white mb-2 leading-tight">
              Selling on Instagram or WhatsApp?
            </h2>
            <p className="text-zinc-400 text-sm md:text-base font-medium leading-relaxed mt-1">
              Bring your products to more people. List your store on Seyon today.
            </p>
          </div>

          <Link
            href="/seller-dashboard"
            className="z-10 mt-6 md:mt-0 shrink-0 select-none cursor-pointer"
          >
            <button className="px-8 py-4 bg-[#A77F3A] hover:bg-[#916b2f] active:scale-95 text-white font-extrabold text-xs md:text-sm uppercase tracking-wider rounded-full shadow-lg transition-all duration-300 flex items-center gap-1.5 justify-center border-none">
              Become a Seller <ArrowRight className="h-4 w-4 stroke-[2.5]" />
            </button>
          </Link>
        </div>
      </section>
    </div>
  );
}
