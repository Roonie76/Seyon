import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db';
import { ProductCard } from '@/components/shared/product-card';
import { ProductCarousel } from '@/components/shared/product-carousel';
import { HomepageSearch } from '@/components/shared/homepage-search';
import { ArrowRight, Heart, Check, CheckCircle, Sparkles, Users, Award, Shield, ShoppingBag, MessageSquare, Play, Search, Menu } from 'lucide-react';
import { getCreatorPresentation, getProductBadges, getHeroReelStats } from '@/lib/demo';

import { auth } from '@/lib/auth';
import { MarketplaceClient } from './marketplace/marketplace-client';
import { searchProductIds, ProductSearchSort } from '@/backend/lib/search';
import { generateItemListJSONLD, safeJsonLdStringify } from '@/lib/seo';
import { RecentlyViewedStrip } from '@/components/shared/recently-viewed';
import { logger } from '@/backend/lib/logger';
import { Prisma } from '@prisma/client';
import { Button } from '@/components/ui/button';

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
      take: 8,
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
  const heroTitle = heroProduct?.title || 'Oud Elixir';
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

  // 10 categories matching mockup with premium Unsplash images
  const mockCategories = [
    { name: 'Oud Perfume', query: 'Oud', img: '/uploads/perfumes/mystic_oud.png' },
    { name: 'Silver Anklets', query: 'Anklet', img: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?q=80&w=300' },
    { name: 'Handmade Candles', query: 'Candle', img: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?q=80&w=300' },
    { name: 'Crochet Tote Bag', query: 'Bag', img: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?q=80&w=300' },
    { name: 'Aesthetic Wall Art', query: 'Art', img: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?q=80&w=300' },
    { name: 'Gold Plated Jewelry', query: 'Jewelry', img: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=300' },
    { name: 'Resin Art', query: 'Resin', img: 'https://images.unsplash.com/photo-1597848212624-a19eb35e2651?q=80&w=300' },
    { name: 'Home Decor', query: 'Decor', img: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?q=80&w=300' },
    { name: 'Phone Cases', query: 'Case', img: 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?q=80&w=300' },
    { name: 'Anime Merch', query: 'Anime', img: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=300' },
  ];

  // 6 trending products badges
  const worthDiscoveringBadges = [
    { text: 'Creator Pick', color: 'bg-amber-600/90 text-white' },
    { text: 'Trending', color: 'bg-amber-500 text-white' },
    { text: 'Viral on Instagram', color: 'bg-pink-600 text-white' },
    { text: 'Recently Added', color: 'bg-zinc-800 text-white' },
    { text: 'Made in India', color: 'bg-[#A77F3A] text-white' },
    { text: 'Customer Favorite', color: 'bg-emerald-600 text-white' }
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
              <div className="text-zinc-700 text-xs sm:text-sm font-semibold tracking-wide flex flex-wrap items-center gap-1.5 leading-relaxed">
                <span>Browse beautifully organized catalogs from creators who sell</span>
                <span className="text-zinc-300 mx-0.5">•</span>
                <span className="inline-flex items-center gap-1 bg-white border border-zinc-150 rounded-full px-2 py-0.5 shadow-3xs hover:border-pink-300 transition-colors cursor-default select-none">
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none">
                    <defs>
                      <linearGradient id="tag-ig-grad" x1="11.5" y1="1" x2="11.5" y2="23" gradientUnits="userSpaceOnUse">
                        <stop offset="0" stopColor="#E040FB"/>
                        <stop offset="0.5" stopColor="#FF4081"/>
                        <stop offset="1" stopColor="#F57C00"/>
                      </linearGradient>
                    </defs>
                    <rect x="2" y="2" width="20" height="20" rx="5" fill="url(#tag-ig-grad)"/>
                    <rect x="5" y="5" width="14" height="14" rx="3" stroke="white" strokeWidth="1.5" fill="none"/>
                    <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="1.5" fill="none"/>
                    <circle cx="16.5" cy="7.5" r="1" fill="white"/>
                  </svg>
                  <span className="text-[10px] font-extrabold text-zinc-700">Instagram</span>
                </span>
                <span className="text-zinc-455">,</span>
                <span className="inline-flex items-center gap-1 bg-white border border-zinc-150 rounded-full px-2 py-0.5 shadow-3xs hover:border-green-300 transition-colors cursor-default select-none">
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none">
                    <rect x="2" y="2" width="20" height="20" rx="5" fill="#25D366"/>
                    <path d="M12 6a5.9 5.9 0 0 0-5.1 8.9L6 18l3.2-.8A5.9 5.9 0 1 0 12 6zm2.8 7.8c-.1.3-.7.6-.9.6s-.5.1-1.5-.3a5.5 5.5 0 0 1-2.4-2.1c-.4-.7-.7-1.4-.7-2.1 0-.7.3-1 .5-1.2.2-.2.4-.2.5-.2h.4c.1 0 .2 0 .3.2.1.2.4 1 .4 1.1s0 .3-.1.4c-.1.1-.2.2-.3.3s-.2.1-.1.3a3.7 3.7 0 0 0 1.4 1.7 3.3 3.3 0 0 0 2 .7c.2 0 .4-.1.5-.2.1-.2.5-.6.6-.8s.2-.2.4-.1.9.4 1 .5c.1 0 .2.1.1.3z" fill="white"/>
                  </svg>
                  <span className="text-[10px] font-extrabold text-zinc-700">WhatsApp</span>
                </span>
                <span className="text-zinc-455">,</span>
                <span className="inline-flex items-center gap-1 bg-white border border-zinc-150 rounded-full px-2 py-0.5 shadow-3xs hover:border-blue-300 transition-colors cursor-default select-none">
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none">
                    <rect x="2" y="2" width="20" height="20" rx="5" fill="#2196F3"/>
                    <path d="M6.8 11.5l9.2-3.6c.4-.2.8.1.7.6l-1.6 7.4c-.1.5-.4.6-.8.3l-2.5-1.9-1.2 1.2c-.1.1-.3.2-.4.2l.2-2.7 4.9-4.5c.2-.2 0-.3-.3-.1l-6.1 3.8-2.6-.8c-.6-.2-.6-.6.2-.9z" fill="white"/>
                  </svg>
                  <span className="text-[10px] font-extrabold text-zinc-700">Telegram</span>
                </span>
                <span className="text-zinc-700 font-semibold">&</span>
                <span className="inline-flex items-center gap-1 bg-white border border-zinc-150 rounded-full px-2 py-0.5 shadow-3xs hover:border-red-300 transition-colors cursor-default select-none">
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none">
                    <rect x="2" y="2" width="20" height="20" rx="5" fill="#FF0000"/>
                    <path d="M10 8.5v7l6-3.5-6-3.5z" fill="white"/>
                  </svg>
                  <span className="text-[10px] font-extrabold text-zinc-700">YouTube</span>
                </span>
                <span className="text-zinc-700 font-semibold">.</span>
              </div>
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

            {/* Phone 2: Overlapping Seyon Catalog Listing (The Organized Layer - full App Mockup) */}
            <Link
              href={heroProductUrl}
              className="absolute top-1/4 right-2 sm:-right-6 w-[215px] h-[440px] bg-white rounded-[2.8rem] border-[7px] border-zinc-900 shadow-2xl overflow-hidden shrink-0 z-20 hover:scale-103 hover:-translate-y-0.5 transition-all duration-500 flex flex-col justify-between p-3 select-none cursor-pointer group"
            >
              {/* Top Notch & Phone Bar */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-3.5 bg-zinc-900 rounded-b-xl z-30" />

              {/* Seyon App Header */}
              <div className="grid grid-cols-3 items-center px-2 pt-4 pb-2 border-b border-zinc-100 font-sans z-10 select-none bg-white">
                <Menu className="h-3.5 w-3.5 text-zinc-500 justify-self-start stroke-[2]" />
                <span className="text-[11px] font-serif font-bold text-zinc-950 justify-self-center">seyon</span>
                <div className="flex items-center gap-1.5 text-zinc-500 justify-self-end">
                  <Search className="h-3 w-3 stroke-[2]" />
                  <ShoppingBag className="h-3 w-3 stroke-[2]" />
                </div>
              </div>

              {/* Product Card Body inside phone screen */}
              <div className="flex-1 flex flex-col justify-between pt-2.5">
                <div className="relative aspect-square w-full rounded-2xl bg-zinc-50 border border-zinc-150 overflow-hidden mb-2">
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
                  <span className="absolute top-2 left-2 z-10 gold-pill-badge text-[7px] px-1.5 py-0.5 rounded-md leading-none font-bold uppercase tracking-wider shadow-sm">
                    Bestseller
                  </span>
                </div>
                
                <div className="flex flex-col text-left px-1">
                  {/* Rating element */}
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="text-[8px] font-extrabold text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-100 uppercase tracking-wide flex items-center gap-0.5 leading-none">
                      ⭐ 4.9 <span className="text-zinc-450 font-medium normal-case">(124 reviews)</span>
                    </span>
                  </div>
                  
                  <span className="text-[11px] font-bold text-zinc-950 leading-tight truncate group-hover:text-[#A77F3A] transition-colors">
                    {heroTitle}
                  </span>
                  <span className="text-[9px] text-zinc-450 font-semibold">
                    by {heroShopName}
                  </span>

                  <span className="text-[11px] font-black text-[#1A1A18] mt-1 block">
                    ₹{heroPrice.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[7px] text-zinc-400 font-semibold block leading-none mt-0.5">
                    Inclusive of all taxes
                  </span>

                  {/* Color Swatches Row */}
                  <div className="flex items-center gap-1 mt-2 mb-0.5 px-0.5">
                    <span className="h-2 w-2 rounded-full bg-[#4E3629] border border-black/10 cursor-pointer" />
                    <span className="h-2 w-2 rounded-full bg-[#8B5A2B] border border-black/10 cursor-pointer" />
                    <span className="h-2 w-2 rounded-full bg-[#C2A679] border border-black/10 cursor-pointer" />
                    <span className="h-2 w-2 rounded-full bg-[#E5D3B3] border border-black/10 cursor-pointer" />
                    <span className="h-2 w-2 rounded-full bg-[#FAF0E6] border border-black/10 cursor-pointer" />
                  </div>
                </div>
                
                {/* WhatsApp direct buy button - Boutique Style */}
                <div className="px-0.5 pb-1">
                  <div className="w-full bg-white border border-[#F0ECE3] hover:border-[#A77F3A]/40 rounded-[20px] py-2 px-3 shadow-3xs flex items-center justify-between transition-all duration-300 group/btn cursor-pointer">
                    <div className="flex-1 text-center pl-4 select-none">
                      <span className="font-serif text-[11px] font-bold text-zinc-950 block leading-tight">Talk to Creator</span>
                      <span className="text-[8px] text-zinc-450 font-bold block mt-0.5">on WhatsApp</span>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-zinc-950 shrink-0 transition-transform group-hover/btn:translate-x-0.5 stroke-[2]" />
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* 2 & 3. Side-by-Side "Why Seyon?" and "Benefits Bar" Grid (Scroll Layout) */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-[1980px] mx-auto w-full mb-16 select-none">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-0 items-center w-full relative">
          {/* Left Card: Why Seyon Comparison Card — Tall, prominent, sits ON TOP */}
          <div className="lg:col-span-5 bg-white border border-[#E9DED0] rounded-[32px] p-6 sm:p-8 lg:px-10 lg:py-12 shadow-[0_14px_36px_rgba(37,28,18,0.10)] flex flex-col justify-between text-left h-full min-h-[340px] relative z-20">
            <h3 className="font-serif text-xl sm:text-2xl font-bold text-zinc-950 text-left mb-7 tracking-tight">Why Seyon?</h3>

            {/* Comparison Side-by-Side Table */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-7 sm:gap-9 relative flex-1">
              {/* Social Media column */}
              <div className="text-left flex flex-col sm:pr-5">
                <span className="text-xs sm:text-sm font-bold text-zinc-800 leading-tight">Shopping on Social Media</span>
                <ul className="flex flex-col gap-3 text-xs sm:text-[13px] text-zinc-700 font-medium mt-4">
                  <li className="flex items-start gap-2 leading-snug">
                    <svg className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <circle cx="12" cy="12" r="9"/>
                      <line x1="9" y1="9" x2="15" y2="15" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                    </svg>
                    <span>Scroll through hundreds of reels</span>
                  </li>
                  <li className="flex items-start gap-2 leading-snug">
                    <svg className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <circle cx="12" cy="12" r="9"/>
                      <line x1="9" y1="9" x2="15" y2="15" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                    </svg>
                    <span>Check highlights & captions</span>
                  </li>
                  <li className="flex items-start gap-2 leading-snug">
                    <svg className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <circle cx="12" cy="12" r="9"/>
                      <line x1="9" y1="9" x2="15" y2="15" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                    </svg>
                    <span>DM for price & details</span>
                  </li>
                  <li className="flex items-start gap-2 leading-snug">
                    <svg className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <circle cx="12" cy="12" r="9"/>
                      <line x1="9" y1="9" x2="15" y2="15" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                    </svg>
                    <span>Wait for replies</span>
                  </li>
                  <li className="flex items-start gap-2 leading-snug">
                    <svg className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <circle cx="12" cy="12" r="9"/>
                      <line x1="9" y1="9" x2="15" y2="15" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                    </svg>
                    <span>Lose it forever</span>
                  </li>
                </ul>
              </div>

              {/* Vertical Divider Line */}
              <div className="hidden sm:block absolute left-1/2 top-0 bottom-0 w-px bg-[#E7E2D8] -translate-x-1/2" />

              {/* VS Badge */}
              <div className="hidden sm:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                <span className="h-8 w-8 rounded-full bg-[#A77F3A] text-white text-[10px] font-black flex items-center justify-center border-2 border-white shadow-[0_8px_18px_rgba(167,127,58,0.28)] select-none">VS</span>
              </div>

              {/* Seyon column */}
              <div className="text-left flex flex-col sm:pl-7">
                <span className="text-xs sm:text-sm font-bold text-zinc-800 leading-tight">Shopping on Seyon</span>
                <ul className="flex flex-col gap-3 text-xs sm:text-[13px] text-zinc-700 font-medium mt-4">
                  <li className="flex items-start gap-2 leading-snug">
                    <svg className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <circle cx="12" cy="12" r="9"/>
                      <path d="M8.5 12.5l2.5 2.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Search what you want</span>
                  </li>
                  <li className="flex items-start gap-2 leading-snug">
                    <svg className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <circle cx="12" cy="12" r="9"/>
                      <path d="M8.5 12.5l2.5 2.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Find verified creators</span>
                  </li>
                  <li className="flex items-start gap-2 leading-snug">
                    <svg className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <circle cx="12" cy="12" r="9"/>
                      <path d="M8.5 12.5l2.5 2.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>View all products in one place</span>
                  </li>
                  <li className="flex items-start gap-2 leading-snug">
                    <svg className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <circle cx="12" cy="12" r="9"/>
                      <path d="M8.5 12.5l2.5 2.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>DM to order instantly</span>
                  </li>
                  <li className="flex items-start gap-2 leading-snug">
                    <svg className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <circle cx="12" cy="12" r="9"/>
                      <path d="M8.5 12.5l2.5 2.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Easy, Fast, Reliable.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Right Card: Benefits Bar — Shorter, rounded only on right, layered behind */}
          <div className="lg:col-span-7 bg-[#FCFAF7] border-y border-r border-[#E9DED0] rounded-r-[24px] rounded-l-none px-6 py-6 sm:px-8 lg:px-10 lg:py-8 shadow-[0_10px_30px_rgba(37,28,18,0.04)] flex items-center justify-center lg:-ml-8 relative z-10 min-h-[260px] lg:self-center" style={{ backgroundImage: 'linear-gradient(180deg, rgba(245,239,227,0.15) 0%, rgba(252,250,247,1) 8%, rgba(252,250,247,1) 92%, rgba(245,239,227,0.15) 100%)' }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-y-8 sm:gap-x-6 lg:gap-x-0 lg:gap-y-0 w-full items-start h-full">
              {/* Benefit 1: From Social Platforms */}
              <div className="px-3 lg:px-5 flex flex-col items-center text-center lg:border-r border-[#E7E2D8] h-full justify-start select-none min-h-[210px]">
                <div className="h-10 w-10 flex items-center justify-center mb-4">
                  <svg className="h-9 w-9 text-[#A77F3A] filter drop-shadow-[0_2px_7px_rgba(167,127,58,0.16)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    {/* Elegant Bear Face Outline */}
                    <path d="M12 6.5c-1.2 0-2.3.2-3.3.6C7.5 5.5 6 4.5 4.5 4.5 3 4.5 2 5.5 2 7c0 1.5 1 3 2.5 3.5.2 2.5 1.8 7.5 7.5 7.5s7.3-5 7.5-7.5c1.5-.5 2.5-2 2.5-3.5 0-1.5-1-2.5-2.5-2.5-1.5 0-3 1-4.2 2.6-1-.4-2.1-.6-3.3-.6z" />
                    {/* Central circle snout */}
                    <circle cx="12" cy="12.5" r="2.5" />
                  </svg>
                </div>
                <div className="flex flex-col items-center">
                  <h4 className="text-xs font-bold text-zinc-900 leading-snug max-w-[120px]">From Social Platforms</h4>
                  <p className="text-[11px] text-zinc-700 mt-3 font-semibold leading-relaxed max-w-[124px]">
                    Instagram, WhatsApp, Telegram & YouTube
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-4">
                  {/* Instagram */}
                  <span className="inline-flex items-center justify-center h-4.5 w-4.5 rounded-md shadow-3xs select-none">
                    <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none">
                      <defs>
                        <linearGradient id="ig-icon-grad" x1="11.5" y1="1" x2="11.5" y2="23" gradientUnits="userSpaceOnUse">
                          <stop offset="0" stopColor="#E040FB"/>
                          <stop offset="0.5" stopColor="#FF4081"/>
                          <stop offset="1" stopColor="#F57C00"/>
                        </linearGradient>
                      </defs>
                      <rect x="2" y="2" width="20" height="20" rx="5" fill="url(#ig-icon-grad)"/>
                      <rect x="5" y="5" width="14" height="14" rx="3" stroke="white" strokeWidth="1.5" fill="none"/>
                      <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="1.5" fill="none"/>
                      <circle cx="16.5" cy="7.5" r="1" fill="white"/>
                    </svg>
                  </span>
                  {/* WhatsApp */}
                  <span className="inline-flex items-center justify-center h-4.5 w-4.5 rounded-md shadow-3xs select-none">
                    <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none">
                      <rect x="2" y="2" width="20" height="20" rx="5" fill="#25D366"/>
                      <path d="M12 6a5.9 5.9 0 0 0-5.1 8.9L6 18l3.2-.8A5.9 5.9 0 1 0 12 6zm2.8 7.8c-.1.3-.7.6-.9.6s-.5.1-1.5-.3a5.5 5.5 0 0 1-2.4-2.1c-.4-.7-.7-1.4-.7-2.1 0-.7.3-1 .5-1.2.2-.2.4-.2.5-.2h.4c.1 0 .2 0 .3.2.1.2.4 1 .4 1.1s0 .3-.1.4c-.1.1-.2.2-.3.3s-.2.1-.1.3a3.7 3.7 0 0 0 1.4 1.7 3.3 3.3 0 0 0 2 .7c.2 0 .4-.1.5-.2.1-.2.5-.6.6-.8s.2-.2.4-.1.9.4 1 .5c.1 0 .2.1.1.3z" fill="white"/>
                    </svg>
                  </span>
                  {/* Telegram */}
                  <span className="inline-flex items-center justify-center h-4.5 w-4.5 rounded-md shadow-3xs select-none">
                    <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none">
                      <rect x="2" y="2" width="20" height="20" rx="5" fill="#2196F3"/>
                      <path d="M6.8 11.5l9.2-3.6c.4-.2.8.1.7.6l-1.6 7.4c-.1.5-.4.6-.8.3l-2.5-1.9-1.2 1.2c-.1.1-.3.2-.4.2l.2-2.7 4.9-4.5c.2-.2 0-.3-.3-.1l-6.1 3.8-2.6-.8c-.6-.2-.6-.6.2-.9z" fill="white"/>
                    </svg>
                  </span>
                  {/* YouTube */}
                  <span className="inline-flex items-center justify-center h-4.5 w-4.5 rounded-md shadow-3xs select-none">
                    <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none">
                      <rect x="2" y="2" width="20" height="20" rx="5" fill="#FF0000"/>
                      <path d="M10 8.5v7l6-3.5-6-3.5z" fill="white"/>
                    </svg>
                  </span>
                </div>
              </div>

              {/* Benefit 2: DM to Order */}
              <div className="px-3 lg:px-5 flex flex-col items-center text-center lg:border-r border-[#E7E2D8] h-full justify-start select-none min-h-[210px]">
                <div className="h-10 w-10 flex items-center justify-center mb-4">
                  <svg className="h-9 w-9 text-[#A77F3A] filter drop-shadow-[0_2px_7px_rgba(167,127,58,0.16)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    {/* Two overlapping chat bubbles */}
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    <path d="M8 9h8" />
                    <path d="M8 13h4" />
                  </svg>
                </div>
                <div className="flex flex-col items-center">
                  <h4 className="text-xs font-bold text-zinc-900 leading-snug">DM to Order</h4>
                  <p className="text-[11px] text-zinc-700 mt-3 font-semibold leading-relaxed max-w-[124px]">
                    Chat directly with creators
                  </p>
                </div>
              </div>

              {/* Benefit 3: No Middlemen */}
              <div className="px-3 lg:px-5 flex flex-col items-center text-center lg:border-r border-[#E7E2D8] h-full justify-start select-none min-h-[210px]">
                <div className="h-10 w-10 flex items-center justify-center mb-4">
                  <svg className="h-9 w-9 text-[#A77F3A] filter drop-shadow-[0_2px_7px_rgba(167,127,58,0.16)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    {/* Person with X – no middlemen */}
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="17" y1="8" x2="23" y2="14" />
                    <line x1="23" y1="8" x2="17" y2="14" />
                  </svg>
                </div>
                <div className="flex flex-col items-center">
                  <h4 className="text-xs font-bold text-zinc-900 leading-snug">No Middlemen</h4>
                  <p className="text-[11px] text-zinc-700 mt-3 font-semibold leading-relaxed max-w-[124px]">
                    Buy directly from independent creators
                  </p>
                </div>
              </div>

              {/* Benefit 4: Support Small */}
              <div className="px-3 lg:px-5 flex flex-col items-center text-center lg:border-r border-[#E7E2D8] h-full justify-start select-none min-h-[210px]">
                <div className="h-10 w-10 flex items-center justify-center mb-4">
                  <svg className="h-9 w-9 text-[#A77F3A] filter drop-shadow-[0_2px_7px_rgba(167,127,58,0.16)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    {/* Group of people – community */}
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div className="flex flex-col items-center">
                  <h4 className="text-xs font-bold text-zinc-900 leading-snug">Support Small</h4>
                  <p className="text-[11px] text-zinc-700 mt-3 font-semibold leading-relaxed max-w-[124px]">
                    Empower independent businesses
                  </p>
                </div>
              </div>

              {/* Benefit 5: Trusted Listings */}
              <div className="px-3 lg:px-5 flex flex-col items-center text-center h-full justify-start select-none min-h-[210px]">
                <div className="h-10 w-10 flex items-center justify-center mb-4">
                  <svg className="h-9 w-9 text-[#A77F3A] filter drop-shadow-[0_2px_7px_rgba(167,127,58,0.16)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    {/* Person with checkmark – verified user */}
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <polyline points="17 11 19 13 23 9" />
                  </svg>
                </div>
                <div className="flex flex-col items-center">
                  <h4 className="text-xs font-bold text-zinc-900 leading-snug">Trusted Listings</h4>
                  <p className="text-[11px] text-zinc-700 mt-3 font-semibold leading-relaxed max-w-[124px]">
                    Verified creators & real products
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Trending Across Creators (10 Category Circles) */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full mb-16">
        <div className="flex items-center justify-between mb-6 pb-2 border-b border-zinc-200">
          <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
            Trending Across Creators
          </h2>
          <Link
            href="/category"
            className="text-xs font-extrabold text-[#A77F3A] hover:text-[#916b2f] flex items-center gap-1 transition-colors"
          >
            View all categories &rarr;
          </Link>
        </div>
        
        <div className="flex items-start overflow-x-auto gap-6 no-scrollbar py-3 scroll-smooth">
          {mockCategories.map((cat) => (
            <Link
              key={cat.name}
              href={`/?q=${encodeURIComponent(cat.query)}`}
              className="group flex flex-col items-center shrink-0 cursor-pointer select-none"
            >
              <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-white shadow-md group-hover:scale-105 transition-transform duration-300 bg-zinc-50 shrink-0">
                {cat.img ? (
                  <Image
                    src={cat.img}
                    alt={cat.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="100px"
                  />
                ) : (
                  <div className="absolute inset-0 bg-zinc-100/10 -z-10 flex items-center justify-center text-lg font-black text-zinc-500 bg-zinc-200 uppercase">{cat.name[0]}</div>
                )}
              </div>
              <span className="text-xs font-bold text-zinc-900 mt-2 text-center leading-tight max-w-[90px] group-hover:text-[#A77F3A] transition-colors">
                {cat.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 5. Just Discovered (Visual Image-Background Overlay Cards matching mockup 100%) */}
      {justDiscovered.length > 0 && (
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full mb-16">
          <div className="flex items-center justify-between mb-6 pb-2 border-b border-zinc-200">
            <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
              Just Discovered <span className="text-xs text-zinc-400 font-semibold font-sans normal-case hidden sm:inline ml-2">— Fresh finds from independent creators across India</span>
            </h2>
            <Link
              href="/?sort=newest"
              className="text-xs font-extrabold text-[#A77F3A] hover:text-[#916b2f] flex items-center gap-1 transition-colors"
            >
              View all &rarr;
            </Link>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {justDiscovered.map((prod, idx) => {
              const presentation = getCreatorPresentation(prod.shop);
              const bgImg = prod.images?.[0]?.url || '';
              
              // Custom static labels matching the mockup design
              const labels = [
                { title: 'A crochet seller from Kerala', desc: 'Handmade with love' },
                { title: 'A perfume creator from Mumbai', desc: 'Luxury fragrances' },
                { title: 'A resin artist from Jaipur', desc: 'One of a kind pieces' },
                { title: 'A home decor brand from Hyderabad', desc: 'Minimal. Aesthetic. Timeless.' },
                { title: 'An art studio from Pune', desc: 'Posters & wall art' }
              ];
              
              const label = labels[idx % labels.length];

              return (
                <Link
                  key={prod.id}
                  href={`/store/${prod.shop.slug}/${prod.slug}`}
                  className="relative aspect-[3/4] rounded-3xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500 group select-none flex flex-col justify-between p-5 text-left cursor-pointer border border-zinc-200/40"
                >
                  {/* Background Image */}
                  {bgImg ? (
                    <Image
                      src={bgImg}
                      alt={prod.title}
                      fill
                      className="object-cover brightness-[50%] group-hover:scale-105 transition-transform duration-500 z-0"
                      sizes="240px"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[#3A3530] z-0" />
                  )}
                  
                  {/* Overlay shadow */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/20 z-[1]" />
                  
                  {/* Top-Right: Verified Badge & Top-Left Title */}
                  <div className="relative flex justify-between items-start w-full z-10">
                    <div className="flex flex-col text-left text-white max-w-[80%]">
                      <h3 className="font-serif text-sm font-bold leading-tight tracking-tight group-hover:text-amber-400 transition-colors">
                        {label.title}
                      </h3>
                      <span className="text-[9px] text-zinc-300 mt-1 font-semibold">
                        {label.desc}
                      </span>
                    </div>
                    {/* Small green verified badge */}
                    <span className="bg-emerald-500 text-white rounded-full p-1 leading-none shadow-md scale-90 flex items-center justify-center shrink-0">
                      <Check className="h-2.5 w-2.5 text-white stroke-[4]" />
                    </span>
                  </div>

                  {/* Bottom: Location Pin */}
                  <div className="relative flex items-center gap-1 text-white mt-auto z-10">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping mr-0.5" />
                    <span className="text-[10px] font-bold tracking-wide uppercase">{presentation.location}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* 6. Meet Independent Creators (Clean White Cards matching mockup) */}
      {featuredCreators.length > 0 && (
        <section id="creators-section" className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full mb-16 scroll-mt-24">
          <div className="flex items-center justify-between mb-6 pb-2 border-b border-zinc-200">
            <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
              Meet Independent Creators
            </h2>
            <Link
              href="/?q=&sort=newest"
              className="text-xs font-extrabold text-[#A77F3A] hover:text-[#916b2f] flex items-center gap-1 transition-colors"
            >
              View all creators &rarr;
            </Link>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {featuredCreators.map((shop) => {
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
                          <span className="bg-emerald-500 text-white rounded-full p-0.5 leading-none scale-85 shrink-0">
                            <Check className="h-2 w-2 text-white stroke-[4]" />
                          </span>
                        )}
                      </h3>
                      
                      {/* Rating block */}
                      <div className="flex items-center gap-1 mt-1.5">
                        <span className="text-[9px] font-extrabold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 uppercase tracking-wide flex items-center gap-0.5 leading-none">
                          ⭐ {presentation.rating.toFixed(1)} <span className="text-zinc-400 font-medium normal-case">({shop.reviewCount || 100})</span>
                        </span>
                      </div>

                      {/* Trust metrics */}
                      <p className="text-[10px] text-zinc-450 mt-3 font-semibold flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {presentation.trustTag}
                      </p>
                      <p className="text-[9px] text-zinc-400 mt-1 uppercase tracking-wider font-bold">
                        {presentation.location} • {shop._count.products} Products
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
        </section>
      )}

      {/* 7. Worth Discovering (horizontal carousel/scroll of 8 handpicked products) */}
      {trendingProducts.length > 0 && (
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full mb-16">
          <div className="flex items-center justify-between mb-6 pb-2 border-b border-zinc-200">
            <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
              Worth Discovering <span className="text-xs text-zinc-400 font-semibold font-sans normal-case hidden sm:inline ml-2">— Handpicked products trending with our community</span>
            </h2>
            <Link
              href="/marketplace"
              className="text-xs font-extrabold text-[#A77F3A] hover:text-[#916b2f] flex items-center gap-1 transition-colors"
            >
              View all products &rarr;
            </Link>
          </div>

          <ProductCarousel>
            {trendingProducts.map((prod, idx) => {
              const badge = worthDiscoveringBadges[idx % worthDiscoveringBadges.length];
              const productUrl = `/store/${prod.shop.slug}/${prod.slug}`;
              return (
                <div key={prod.id} className="px-1 py-2">
                  <Link
                    href={productUrl}
                    className="relative group flex flex-col text-left w-[200px] shrink-0 bg-white border border-[#F0ECE3] rounded-[2rem] p-3 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 h-[280px] justify-between cursor-pointer no-underline"
                  >
                    <div className="relative aspect-square w-full rounded-2xl bg-zinc-50 border border-zinc-150 overflow-hidden mb-3">
                      {prod.images?.[0]?.url ? (
                        <Image
                          src={prod.images[0].url}
                          alt={prod.title}
                          fill
                          className="object-cover group-hover:scale-103 transition-transform duration-300"
                          sizes="180px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-zinc-400">No Image</div>
                      )}
                      {/* Top-Left Custom Badge overlay matching mockup */}
                      <span className={`absolute top-2 left-2 z-10 text-[8px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded shadow-sm ${badge.color}`}>
                        {badge.text}
                      </span>
                    </div>

                    <div className="flex flex-col flex-1 justify-between">
                      <div>
                        <span className="text-[10px] text-zinc-450 font-semibold">
                          by {prod.shop.name}
                        </span>
                        <h3 className="text-xs font-bold text-zinc-950 leading-snug truncate mt-0.5 group-hover:text-[#A77F3A] transition-colors">
                          {prod.title}
                        </h3>
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-zinc-100">
                        <span className="text-xs font-black text-zinc-950">
                          ₹{prod.price.toFixed(0)}
                        </span>
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </ProductCarousel>
        </section>
      )}

      {/* 8. Curated Collections (5 columns layout matching mockup) */}
      <section id="collections-section" className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full mb-16 scroll-mt-24">
        <div className="flex items-center justify-between mb-6 pb-2 border-b border-zinc-200">
          <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
            Shop by Collections
          </h2>
          <Link
            href="/?q=&sort=newest"
            className="text-xs font-extrabold text-[#A77F3A] hover:text-[#916b2f] flex items-center gap-1 transition-colors"
          >
            Explore all collections &rarr;
          </Link>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {/* Collection 1: Wedding Gifts */}
          <Link
            href="/?q=Gift"
            className="relative h-[180px] sm:h-[220px] rounded-[28px] overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-500 group cursor-pointer select-none border border-zinc-200/20"
          >
            <Image
              src="https://images.unsplash.com/photo-1511285560929-80b456fea0bc?q=80&w=600"
              alt="Wedding Gifts Collection"
              fill
              className="object-cover brightness-70 group-hover:scale-105 transition-transform duration-500 z-0"
              sizes="240px"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#A77F3A]/20 to-[#1A1A18]/90 z-[1]" />
            <div className="absolute inset-0 p-5 flex flex-col justify-between text-left text-white h-full z-10">
              <div>
                <h3 className="font-serif text-xl font-bold leading-tight tracking-tight">
                  Wedding Gifts
                </h3>
                <p className="text-[10px] text-zinc-300 mt-1 font-semibold">Thoughtful picks</p>
              </div>
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-white group-hover:text-amber-400 transition-colors flex items-center gap-1 mt-auto">
                Explore <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>

          {/* Collection 2: Minimal Homes */}
          <Link
            href="/?q=Decor"
            className="relative h-[180px] sm:h-[220px] rounded-[28px] overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-500 group cursor-pointer select-none border border-zinc-200/20"
          >
            <Image
              src="https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?q=80&w=600"
              alt="Minimal Homes Collection"
              fill
              className="object-cover brightness-70 group-hover:scale-105 transition-transform duration-500 z-0"
              sizes="240px"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-700/20 to-zinc-950/95 z-[1]" />
            <div className="absolute inset-0 p-5 flex flex-col justify-between text-left text-white h-full z-10">
              <div>
                <h3 className="font-serif text-xl font-bold leading-tight tracking-tight">
                  Minimal Homes
                </h3>
                <p className="text-[10px] text-zinc-300 mt-1 font-semibold">Less is more</p>
              </div>
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-white group-hover:text-amber-400 transition-colors flex items-center gap-1 mt-auto">
                Explore <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>

          {/* Collection 3: Trending on Instagram */}
          <Link
            href="/?q=Viral"
            className="relative h-[180px] sm:h-[220px] rounded-[28px] overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-500 group cursor-pointer select-none border border-zinc-200/20"
          >
            <Image
              src="https://images.unsplash.com/photo-1590874103328-eac38a683ce7?q=80&w=600"
              alt="Trending on Instagram Collection"
              fill
              className="object-cover brightness-70 group-hover:scale-105 transition-transform duration-500 z-0"
              sizes="240px"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-stone-600/20 to-stone-950/95 z-[1]" />
            <div className="absolute inset-0 p-5 flex flex-col justify-between text-left text-white h-full z-10">
              <div>
                <h3 className="font-serif text-xl font-bold leading-tight tracking-tight">
                  Trending on Instagram
                </h3>
                <p className="text-[10px] text-zinc-300 mt-1 font-semibold">Bestsellers you love</p>
              </div>
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-white group-hover:text-amber-400 transition-colors flex items-center gap-1 mt-auto">
                Explore <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>

          {/* Collection 4: Made in India */}
          <Link
            href="/?q=Handmade"
            className="relative h-[180px] sm:h-[220px] rounded-[28px] overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-500 group cursor-pointer select-none border border-zinc-200/20"
          >
            <Image
              src="https://images.unsplash.com/photo-1603006905003-be475563bc59?q=80&w=600"
              alt="Made in India Collection"
              fill
              className="object-cover brightness-70 group-hover:scale-105 transition-transform duration-500 z-0"
              sizes="240px"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#9B702B]/20 to-neutral-950/95 z-[1]" />
            <div className="absolute inset-0 p-5 flex flex-col justify-between text-left text-white h-full z-10">
              <div>
                <h3 className="font-serif text-xl font-bold leading-tight tracking-tight">
                  Made in India
                </h3>
                <p className="text-[10px] text-zinc-300 mt-1 font-semibold">Proudly local</p>
              </div>
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-white group-hover:text-amber-400 transition-colors flex items-center gap-1 mt-auto">
                Explore <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>

          {/* Collection 5: Under 1000 */}
          <Link
            href="/?maxPrice=1000"
            className="relative h-[180px] sm:h-[220px] rounded-[28px] overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-500 group cursor-pointer select-none border border-zinc-200/20"
          >
            <Image
              src="https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=600"
              alt="Under 1000 Collection"
              fill
              className="object-cover brightness-70 group-hover:scale-105 transition-transform duration-500 z-0"
              sizes="240px"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#9B702B]/30 to-[#1A1A18]/95 z-[1]" />
            <div className="absolute inset-0 p-5 flex flex-col justify-between text-left text-white h-full z-10">
              <div>
                <h3 className="font-serif text-xl font-bold leading-tight tracking-tight">
                  Under ₹1000
                </h3>
                <p className="text-[10px] text-zinc-300 mt-1 font-semibold">Budget friendly finds</p>
              </div>
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-white group-hover:text-amber-400 transition-colors flex items-center gap-1 mt-auto">
                Explore <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>
        </div>
      </section>
      {/* Rebuilt Premium Benefits Bar Section (Ditto Mockup) */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full mb-16 select-none">
        <div className="bg-[#FCFAF7] border border-[#F0ECE3] rounded-[24px] py-5 px-4 sm:px-6 md:py-6 shadow-3xs">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-y-6 sm:gap-y-0 w-full items-center">
            {/* Column 1: Verified Creators */}
            <div className="flex items-center gap-3.5 px-2 lg:px-6 justify-start sm:border-r border-[#F0ECE3] last:border-r-0 h-full">
              <svg className="h-8 w-8 text-[#A77F3A] shrink-0 filter drop-shadow-[0_1.5px_4px_rgba(167,127,58,0.1)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="10" r="7" />
                <path d="M8.5 16.5 6 22l6-2 6 2-2.5-5.5" />
                <path d="m9 10 2 2 4-4" />
              </svg>
              <div className="text-left flex flex-col ml-1">
                <span className="text-xs sm:text-[13px] font-bold text-zinc-900 leading-tight">Verified Creators</span>
                <span className="text-[10px] text-zinc-500 font-medium mt-0.5 leading-tight">Quality sellers you can trust</span>
              </div>
            </div>

            {/* Column 2: Secure & Safe */}
            <div className="flex items-center gap-3.5 px-2 lg:px-6 justify-start sm:border-r border-[#F0ECE3] last:border-r-0 h-full">
              <svg className="h-8 w-8 text-[#A77F3A] shrink-0 filter drop-shadow-[0_1.5px_4px_rgba(167,127,58,0.1)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <rect x="9" y="11" width="6" height="5" rx="1" />
                <path d="M10 11V9a2 2 0 0 1 4 0v2" />
              </svg>
              <div className="text-left flex flex-col ml-1">
                <span className="text-xs sm:text-[13px] font-bold text-zinc-900 leading-tight">Secure & Safe</span>
                <span className="text-[10px] text-zinc-500 font-medium mt-0.5 leading-tight">Your privacy is important</span>
              </div>
            </div>

            {/* Column 3: Chat on WhatsApp */}
            <div className="flex items-center gap-3.5 px-2 lg:px-6 justify-start sm:border-r border-[#F0ECE3] last:border-r-0 h-full">
              <svg className="h-8 w-8 text-[#A77F3A] shrink-0 filter drop-shadow-[0_1.5px_4px_rgba(167,127,58,0.1)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.3 8.3 0 0 1-8.3 8.3 8.3 8.3 0 0 1-4-.1L4 20.8l1.1-4.6a8.3 8.3 0 1 1 15.9-4.7z" />
                <path d="M15.4 14c-.2-.1-.9-.4-1.1-.5s-.3-.1-.4 0-.4.5-.5.6-.2.2-.4.1A5.3 5.3 0 0 1 10.3 12a4.8 4.8 0 0 1-1-1.3c-.1-.2 0-.3.1-.4s.2-.2.3-.3v-.3c0-.1-.1-.3-.3-.6s-.4-.5-.5-.5h-.3c-.1 0-.3.1-.4.2s-.5.5-.5 1.1.4 1.3.5 1.4c.1.1 1.7 2.6 4.1 3.6a13.3 13.3 0 0 0 1.4.5c.6.2 1.1.2 1.5.1s1-.4 1.1-1c.2-.5.2-1 0-1.1z" />
              </svg>
              <div className="text-left flex flex-col ml-1">
                <span className="text-xs sm:text-[13px] font-bold text-zinc-900 leading-tight">Chat on WhatsApp</span>
                <span className="text-[10px] text-zinc-500 font-medium mt-0.5 leading-tight">Direct & transparent</span>
              </div>
            </div>

            {/* Column 4: Easy Returns* */}
            <div className="flex items-center gap-3.5 px-2 lg:px-6 justify-start sm:border-r border-[#F0ECE3] last:border-r-0 h-full">
              <svg className="h-8 w-8 text-[#A77F3A] shrink-0 filter drop-shadow-[0_1.5px_4px_rgba(167,127,58,0.1)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              <div className="text-left flex flex-col ml-1">
                <span className="text-xs sm:text-[13px] font-bold text-zinc-900 leading-tight">Easy Returns*</span>
                <span className="text-[10px] text-zinc-500 font-medium mt-0.5 leading-tight">Hassle free returns</span>
              </div>
            </div>

            {/* Column 5: Made in India */}
            <div className="flex items-center gap-3.5 px-2 lg:px-6 justify-start sm:border-r border-[#F0ECE3] last:border-r-0 h-full">
              <svg className="h-8 w-8 text-[#A77F3A] shrink-0 filter drop-shadow-[0_1.5px_4px_rgba(167,127,58,0.1)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                {/* Center petal */}
                <path d="M12 2C10 7 10 13 12 18C14 13 14 7 12 2Z" />
                {/* Left side petals */}
                <path d="M12 6C7 9 6 14 9 17C10 18 11.5 16 12 14" />
                <path d="M12 10C5 13 4 17 8 18C10 18.5 11.5 17 12 15" />
                {/* Right side petals */}
                <path d="M12 6C17 9 18 14 15 17C14 18 12.5 16 12 14" />
                <path d="M12 10C19 13 20 17 16 18C15 18.5 13.5 17 12 15" />
                {/* Stem/Base */}
                <path d="M10 20C11 21 13 21 14 20" />
              </svg>
              <div className="text-left flex flex-col ml-1">
                <span className="text-xs sm:text-[13px] font-bold text-zinc-900 leading-tight flex items-center gap-1">Made with <span className="text-red-500">❤️</span> in India</span>
                <span className="text-[10px] text-zinc-500 font-medium mt-0.5 leading-tight">Supporting local businesses</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 10. New Creators This Week (Carousel Slider) */}
      {recentlyAddedStores.length > 0 && (
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full mb-16">
          <div className="flex items-center justify-between mb-6 pb-2 border-b border-zinc-200">
            <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
              New Creators This Week
            </h2>
            <Link
              href="/?q=&sort=newest"
              className="text-xs font-extrabold text-[#A77F3A] hover:text-[#916b2f] flex items-center gap-1 transition-colors"
            >
              See all new creators &rarr;
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

      {/* 11. Footer Seller Sign-up CTA Banner */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="bg-[#1A1A18] text-white rounded-[2.5rem] p-8 md:p-12 flex flex-col md:flex-row items-center justify-between relative overflow-hidden text-center md:text-left shadow-xl">
          <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#A77F3A]/25 blur-[100px] pointer-events-none" />
          
          {/* Subtle shop outline vector graphic simulation using CSS/SVG */}
          <div className="absolute right-12 bottom-0 w-48 h-48 opacity-10 pointer-events-none hidden md:block">
            <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" className="w-full h-full text-white" strokeWidth="2">
              <rect x="10" y="30" width="80" height="60" rx="4" />
              <path d="M 10 30 L 50 10 L 90 30 Z" />
              <rect x="35" y="55" width="30" height="35" />
            </svg>
          </div>

          <div className="flex flex-col z-10 text-left max-w-xl">
            <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-white mb-2 leading-tight">
              The Catalog Layer<br />
              for Social Commerce.
            </h2>
            <p className="text-zinc-400 text-sm md:text-base font-medium leading-relaxed mt-2.5">
              List your store on Seyon and get discovered by thousands of buyers across India.
            </p>
          </div>

          <a
            href="/sell"
            className="z-10 mt-6 md:mt-0 shrink-0 select-none cursor-pointer"
          >
            <button className="px-8 py-4 bg-[#A77F3A] hover:bg-[#916b2f] active:scale-95 text-white font-extrabold text-xs md:text-sm uppercase tracking-wider rounded-full shadow-lg transition-all duration-300 flex items-center gap-1.5 justify-center border-none">
              Become a Seller <ArrowRight className="h-4 w-4 stroke-[2.5]" />
            </button>
          </a>
        </div>
      </section>
    </div>
  );
}
