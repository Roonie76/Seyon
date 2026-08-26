import { db } from '@/lib/db';
import { DISCOVERABLE_SHOP } from '@/backend/lib/shop-visibility';
import { Prisma } from '@prisma/client';
import { searchProductIds, ProductSearchSort } from '@/backend/lib/search';
import { logger } from '@/backend/lib/logger';
import { parsePage, parsePriceRange, parseRating } from '@/shared/lib/search-params';

/**
 * Canonical product type returned by shopper queries.
 * Matches the Prisma payload shape used across the homepage and category pages.
 */
export type ShopperProduct = Prisma.ProductGetPayload<{
  include: {
    images: { select: { url: true } };
    shop: { select: { name: true; slug: true; isVerified: true } };
  };
}>;

/** Standard include clause reused by all shopper product queries. */
const PRODUCT_INCLUDE = {
  images: { orderBy: { displayOrder: 'asc' as const }, take: 1 },
  shop: { select: { name: true, slug: true, isVerified: true } },
} satisfies Prisma.ProductInclude;

// ---------------------------------------------------------------------------
// fetchShopperCategoriesAndCities
// ---------------------------------------------------------------------------

export interface CategoriesAndCities {
  categories: { name: string; count: number }[];
  cities: string[];
}

/**
 * Fetches the distinct list of active product categories (with counts)
 * and the distinct list of seller cities.
 *
 * Extracted verbatim from the homepage query at page.tsx L270-L291.
 */
export async function fetchShopperCategoriesAndCities(): Promise<CategoriesAndCities> {
  const categoriesRaw = await db.product.groupBy({
    by: ['category'],
    where: {
      status: 'ACTIVE',
      shop: DISCOVERABLE_SHOP,
    },
    _count: {
      id: true,
    },
  });
  const categories = categoriesRaw
    .map((c) => ({
      name: c.category,
      count: c._count.id,
    }))
    .sort((a, b) => b.count - a.count);

  const cityRows = await db.shop.findMany({
    where: { ...DISCOVERABLE_SHOP, city: { not: null } },
    select: { city: true },
    distinct: ['city'],
    take: 100,
  });
  const cities = cityRows.map((r) => r.city as string).sort();

  return { categories, cities };
}

// ---------------------------------------------------------------------------
// fetchShopperProducts
// ---------------------------------------------------------------------------

export interface ShopperProductsParams {
  query?: string;
  category?: string;
  city?: string;
  inStockOnly?: boolean;
  sort?: string;
  page?: number;
  itemsPerPage?: number;
  minPrice?: string;
  maxPrice?: string;
  rating?: string;
}

export interface ShopperProductsResult {
  products: ShopperProduct[];
  discoveryProducts: ShopperProduct[];
  totalProducts: number;
}

/**
 * Fetches products for shopper-facing catalog views (homepage and category pages).
 *
 * This function reproduces the exact query logic from page.tsx L293-L399:
 *   - When `query` is provided, uses Postgres full-text search via searchProductIds,
 *     then hydrates with findMany preserving relevance order.
 *   - When `query` is absent, builds a Prisma filter with category/city/stock/price/
 *     rating conditions and applies pagination + sorting.
 *   - When a text search returns fewer than 4 results, fetches additional discovery
 *     products to backfill the grid.
 */
export async function fetchShopperProducts(
  params: ShopperProductsParams
): Promise<ShopperProductsResult> {
  const {
    query = '',
    category = '',
    city = '',
    inStockOnly = false,
    sort = query ? 'relevance' : 'newest',
    page = 1,
    itemsPerPage = 8,
    minPrice = '',
    maxPrice = '',
    rating = '',
  } = params;

  // Every one of these arrives from the URL and cannot be trusted.
  const safePage = parsePage(String(page));

  let products: ShopperProduct[] = [];
  let discoveryProducts: ShopperProduct[] = [];
  let totalProducts = 0;

  try {
    if (query) {
      // --- Full-text search path (page.tsx L293-L339) ---
      const { min: minVal, max: maxVal } = parsePriceRange(minPrice, maxPrice);
      const searchSort: ProductSearchSort =
        sort === 'price-asc' || sort === 'price-desc' || sort === 'newest' ? sort : 'relevance';

      const { ids, total } = await searchProductIds({
        query,
        category: category || undefined,
        city: city || undefined,
        inStockOnly,
        minPrice: minVal,
        maxPrice: maxVal,
        sort: searchSort,
        page: safePage,
        perPage: itemsPerPage,
        rating: parseRating(rating),
      });

      const found = await db.product.findMany({
        where: { id: { in: ids } },
        include: PRODUCT_INCLUDE,
      });
      const byId = new Map(found.map((prod) => [prod.id, prod]));
      products = ids
        .map((id) => byId.get(id))
        .filter((prod): prod is NonNullable<typeof prod> => Boolean(prod));
      totalProducts = total;

      if (products.length < 4) {
        discoveryProducts = await db.product.findMany({
          where: {
            id: { notIn: products.map((product) => product.id) },
            status: 'ACTIVE',
            shop: DISCOVERABLE_SHOP,
          },
          include: PRODUCT_INCLUDE,
          orderBy: [{ inStock: 'desc' }, { createdAt: 'desc' }],
          take: 4,
        });
      }
    } else {
      // --- Prisma filter path (page.tsx L340-L399) ---
      const filterConditions: Prisma.ProductWhereInput = {
        status: 'ACTIVE',
        shop: DISCOVERABLE_SHOP,
      };

      if (category) {
        filterConditions.category = category;
      }

      if (city) {
        filterConditions.shop = {
          ...DISCOVERABLE_SHOP,
          city: { equals: city, mode: 'insensitive' },
        };
      }

      if (inStockOnly) {
        filterConditions.inStock = true;
      }

      const { min: minVal, max: maxVal } = parsePriceRange(minPrice, maxPrice);
      if (minVal !== undefined || maxVal !== undefined) {
        const priceFilter: Prisma.FloatFilter = {};
        if (minVal !== undefined) priceFilter.gte = minVal;
        if (maxVal !== undefined) priceFilter.lte = maxVal;
        filterConditions.price = priceFilter;
      }

      const ratingVal = parseRating(rating);
      if (ratingVal !== undefined) {
        filterConditions.shop = {
          ...(filterConditions.shop as Prisma.ShopWhereInput),
          averageRating: { gte: ratingVal },
        };
      }

      let orderBy: Prisma.ProductOrderByWithRelationInput[] = [
        { inStock: 'desc' },
        { createdAt: 'desc' },
      ];
      if (sort === 'price-asc') orderBy = [{ inStock: 'desc' }, { price: 'asc' }];
      else if (sort === 'price-desc') orderBy = [{ inStock: 'desc' }, { price: 'desc' }];

      [products, totalProducts] = await Promise.all([
        db.product.findMany({
          where: filterConditions,
          include: PRODUCT_INCLUDE,
          orderBy,
          skip: (safePage - 1) * itemsPerPage,
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

  return { products, discoveryProducts, totalProducts };
}
