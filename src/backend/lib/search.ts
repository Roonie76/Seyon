import { Prisma } from '@prisma/client';
import { db } from './db';

/**
 * Index-backed product search.
 *
 * Uses Postgres full-text search (websearch_to_tsquery) over
 * title + description + category, with an ILIKE fallback on title for
 * partial-word matches. Both paths are backed by GIN indexes created in
 * prisma/sql/fts-indexes.sql — keep the tsvector expression below in sync
 * with that file.
 */

export type ProductSearchSort = 'relevance' | 'newest' | 'price-asc' | 'price-desc';

export interface ProductSearchParams {
  query: string;
  category?: string;
  city?: string;
  inStockOnly?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sort?: ProductSearchSort;
  page?: number;
  perPage?: number;
  rating?: number;
}

export interface ProductSearchResult {
  /** Matching product ids, ordered. Hydrate with findMany + reorder. */
  ids: string[];
  total: number;
}

const TSV = Prisma.sql`to_tsvector('english', coalesce(p."title", '') || ' ' || coalesce(p."description", '') || ' ' || coalesce(p."category", ''))`;

export async function searchProductIds(params: ProductSearchParams): Promise<ProductSearchResult> {
  const { query, category, city, inStockOnly, minPrice, maxPrice, sort = 'relevance', page = 1, perPage = 8, rating } = params;

  const tsQuery = Prisma.sql`websearch_to_tsquery('english', ${query})`;

  const conditions: Prisma.Sql[] = [
    Prisma.sql`p."status" = 'ACTIVE'`,
    Prisma.sql`s."isSuspended" = false`,
    Prisma.sql`s."isPaused" = false`,
    Prisma.sql`(${TSV} @@ ${tsQuery} OR p."title" ILIKE ${'%' + query + '%'})`,
  ];

  if (category) conditions.push(Prisma.sql`p."category" = ${category}`);
  if (city) conditions.push(Prisma.sql`s."city" ILIKE ${city}`);
  if (inStockOnly) conditions.push(Prisma.sql`p."inStock" = true`);
  if (minPrice !== undefined && !Number.isNaN(minPrice)) conditions.push(Prisma.sql`p."price" >= ${Math.max(0, minPrice)}`);
  if (maxPrice !== undefined && !Number.isNaN(maxPrice)) conditions.push(Prisma.sql`p."price" <= ${Math.max(0, maxPrice)}`);
  if (rating !== undefined && !Number.isNaN(rating)) conditions.push(Prisma.sql`s."averageRating" >= ${rating}`);

  // Sold-out products always sort after in-stock ones.
  let orderBy: Prisma.Sql;
  switch (sort) {
    case 'price-asc':
      orderBy = Prisma.sql`p."inStock" DESC, p."price" ASC`;
      break;
    case 'price-desc':
      orderBy = Prisma.sql`p."inStock" DESC, p."price" DESC`;
      break;
    case 'newest':
      orderBy = Prisma.sql`p."inStock" DESC, p."createdAt" DESC`;
      break;
    default:
      orderBy = Prisma.sql`p."inStock" DESC, ts_rank(${TSV}, ${tsQuery}) DESC, p."createdAt" DESC`;
  }

  const offset = (Math.max(1, page) - 1) * perPage;

  const rows = await db.$queryRaw<{ id: string; total: bigint }[]>(Prisma.sql`
    SELECT p."id", COUNT(*) OVER() AS total
    FROM "Product" p
    JOIN "Shop" s ON s."id" = p."shopId"
    WHERE ${Prisma.join(conditions, ' AND ')}
    ORDER BY ${orderBy}
    LIMIT ${perPage} OFFSET ${offset}
  `);

  return {
    ids: rows.map((r) => r.id),
    total: rows.length > 0 ? Number(rows[0].total) : 0,
  };
}
