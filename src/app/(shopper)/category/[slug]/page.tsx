import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ShoppingBag } from 'lucide-react';
import { ProductCard } from '@/components/shared/product-card';
import { MarketplaceClient } from '@/app/(shopper)/marketplace/marketplace-client';
import { BackButton } from '@/components/shared/back-button';
import { Breadcrumbs } from '@/components/shared/breadcrumbs';
import { Button } from '@/components/ui/button';
import { RecentlyViewedStrip } from '@/components/shared/recently-viewed';
import {
  generateItemListJSONLD,
  generateBreadcrumbJSONLD,
  safeJsonLdStringify,
} from '@/lib/seo';
import { logger } from '@/backend/lib/logger';
import {
  fetchShopperProducts,
  fetchShopperCategoriesAndCities,
  type ShopperProduct,
} from '@/backend/lib/shopper-products';

export const revalidate = 300;

// ---------------------------------------------------------------------------
// Category name resolution
// ---------------------------------------------------------------------------

const CATEGORY_MAP: Record<string, string> = {
  fashion: 'Fashion',
  electronics: 'Electronics',
  beauty: 'Beauty',
  'home %26 living': 'Home & Living',
  'home & living': 'Home & Living',
  'clay crafts': 'Clay Crafts',
  'diy crafts': 'DIY Crafts',
  'art %26 collectibles': 'Art & Collectibles',
  'art & collectibles': 'Art & Collectibles',
  'food %26 beverages': 'Food & Beverages',
  'food & beverages': 'Food & Beverages',
};

function resolveCategoryName(slug: string): string {
  const decoded = decodeURIComponent(slug);
  return (
    CATEGORY_MAP[slug.toLowerCase()] ||
    CATEGORY_MAP[decoded.toLowerCase()] ||
    decoded.charAt(0).toUpperCase() + decoded.slice(1)
  );
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    city?: string;
    inStock?: string;
    sort?: string;
    page?: string;
    minPrice?: string;
    maxPrice?: string;
    rating?: string;
    q?: string;
  }>;
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const categoryName = resolveCategoryName(resolvedParams.slug);
  const canonicalSlug = encodeURIComponent(
    categoryName.toLowerCase()
  );

  return {
    title: `${categoryName} — Buy Direct from Independent Sellers | Seyon`,
    description: `Browse ${categoryName} products on Seyon. Shop direct from independent creators and sellers — chat to buy on WhatsApp.`,
    alternates: {
      canonical: `/category/${canonicalSlug}`,
    },
  };
}

// ---------------------------------------------------------------------------
// Static params (pre-render top categories at build time)
// ---------------------------------------------------------------------------

export async function generateStaticParams() {
  return [
    { slug: 'fashion' },
    { slug: 'electronics' },
    { slug: 'beauty' },
    { slug: 'home %26 living' },
    { slug: 'clay crafts' },
    { slug: 'diy crafts' },
    { slug: 'art %26 collectibles' },
    { slug: 'food %26 beverages' },
  ];
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const resolvedParams = await params;
  const sp = await searchParams;
  const categoryName = resolveCategoryName(resolvedParams.slug);

  const query = sp.q || '';
  const selectedCity = sp.city || '';
  const sort = sp.sort || (query ? 'relevance' : 'newest');
  const inStockOnly = sp.inStock === '1';
  const page = parseInt(sp.page || '1', 10);
  const minPrice = sp.minPrice || '';
  const maxPrice = sp.maxPrice || '';
  const rating = sp.rating || '';
  const itemsPerPage = 8;

  // Fetch session + wishlist
  const session = await auth();
  const user = session?.user;
  let wishlistedProductIds = new Set<string>();

  if (user && user.id) {
    try {
      const userWishlist = await db.wishlist.findMany({
        where: { userId: user.id },
        select: { productId: true },
      });
      wishlistedProductIds = new Set(
        userWishlist.map((w) => w.productId)
      );
    } catch (error) {
      logger.error('Error fetching wishlist for category page', error);
    }
  }

  // Fetch products and sidebar data in parallel
  const [catCities, productResult] = await Promise.all([
    fetchShopperCategoriesAndCities(),
    fetchShopperProducts({
      query,
      category: categoryName,
      city: selectedCity,
      inStockOnly,
      sort,
      page,
      itemsPerPage,
      minPrice,
      maxPrice,
      rating,
    }),
  ]);

  const { categories, cities } = catCities;
  const { products, totalProducts } = productResult;
  const totalPages = Math.ceil(totalProducts / itemsPerPage);

  // --- JSON-LD ---
  const itemListJsonLd = generateItemListJSONLD(
    `${categoryName} products on Seyon`,
    products.map((prod) => ({
      title: prod.title,
      url: `/store/${prod.shop.slug}/${prod.slug}`,
    }))
  );

  const breadcrumbJsonLd = generateBreadcrumbJSONLD([
    { name: 'Marketplace', url: '/marketplace' },
    { name: 'Categories', url: '/category' },
    {
      name: categoryName,
      url: `/category/${encodeURIComponent(categoryName.toLowerCase())}`,
    },
  ]);

  // Build pagination URLs
  const baseSlug = encodeURIComponent(categoryName.toLowerCase());
  const buildPaginationUrl = (p: number) => {
    const paginationParams = new URLSearchParams();
    if (query) paginationParams.set('q', query);
    if (selectedCity) paginationParams.set('city', selectedCity);
    if (inStockOnly) paginationParams.set('inStock', '1');
    if (sort && sort !== 'newest') paginationParams.set('sort', sort);
    if (minPrice) paginationParams.set('minPrice', minPrice);
    if (maxPrice) paginationParams.set('maxPrice', maxPrice);
    if (rating) paginationParams.set('rating', rating);
    const baseQs = paginationParams.toString();
    return `/category/${baseSlug}?${baseQs}${baseQs ? '&' : ''}page=${p}`;
  };

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 bg-background text-foreground">
      {/* Inject JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify(itemListJsonLd),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify(breadcrumbJsonLd),
        }}
      />

      {/* Navigation */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8">
        <BackButton fallbackHref="/category" label="All Categories" />
        <Breadcrumbs
          items={[
            { label: 'Categories', href: '/category' },
            { label: categoryName },
          ]}
        />
      </div>

      {/* Page Heading */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
          {categoryName}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse {categoryName.toLowerCase()} products from independent
          sellers — chat to buy on WhatsApp.
        </p>
      </div>

      <MarketplaceClient
        categories={categories}
        selectedCategory={categoryName}
        cities={cities}
        selectedCity={selectedCity}
        inStockOnly={inStockOnly}
        sort={sort}
        minPrice={minPrice}
        maxPrice={maxPrice}
        rating={rating}
        query={query}
        baseUrl={`/category/${baseSlug}`}
      >
        <div>
          <div className="flex flex-col gap-1 mb-6">
            <span className="text-sm text-muted-foreground">
              Showing{' '}
              <span className="text-foreground font-bold">
                {products.length}
              </span>{' '}
              of{' '}
              <span className="text-foreground font-bold">
                {totalProducts}
              </span>{' '}
              {query ? 'matching products' : 'products'}
            </span>
          </div>

          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 border border-dashed border-zinc-200 rounded-xl bg-card shadow-sm">
              <ShoppingBag className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-bold text-foreground mb-1">
                No products found
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                No {categoryName.toLowerCase()} products are currently
                available. Check back later!
              </p>
              <Link href="/category">
                <Button variant="outline">Browse All Categories</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 justify-items-center max-w-6xl mx-auto w-full">
              {products.map((prod) => (
                <ProductCard
                  key={prod.id}
                  product={prod}
                  initialIsWishlisted={wishlistedProductIds.has(
                    prod.id
                  )}
                  layout="vertical"
                />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-12 border-t border-zinc-200 pt-6">
              <Link
                href={buildPaginationUrl(page - 1)}
                className={
                  page === 1 ? 'pointer-events-none opacity-40' : ''
                }
              >
                <Button variant="outline" size="sm">
                  Previous
                </Button>
              </Link>
              {Array.from({ length: totalPages }).map((_, idx) => {
                const pNum = idx + 1;
                return (
                  <Link key={pNum} href={buildPaginationUrl(pNum)}>
                    <Button
                      variant={page === pNum ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 w-8 p-0"
                    >
                      {pNum}
                    </Button>
                  </Link>
                );
              })}
              <Link
                href={buildPaginationUrl(page + 1)}
                className={
                  page === totalPages
                    ? 'pointer-events-none opacity-40'
                    : ''
                }
              >
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
