/**
 * Parsing for untrusted URL query parameters.
 *
 * Catalogue pages read `?page`, `?minPrice`, `?maxPrice` and `?rating`
 * straight from the URL. Previously `parseInt(params.page)` on "abc" produced
 * NaN, which reached Prisma as `skip: NaN`, threw, was swallowed by a
 * try/catch, and rendered an empty catalogue — the shopper saw "No products"
 * for what was really a malformed link. `?page=0` and `?page=-3` did the same
 * via a negative skip.
 *
 * Everything here clamps to a sane range instead of failing.
 */

export const MAX_PAGE = 1000;

/** 1-based page number. Anything unparseable, zero or negative becomes 1. */
export function parsePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_PAGE);
}

/**
 * A price bound from a filter input. Returns undefined when absent or
 * unparseable so the caller can omit the condition entirely, rather than
 * silently filtering everything out.
 */
export function parsePriceBound(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === '') return undefined;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

/** Minimum star rating filter, clamped to the 0–5 the data can express. */
export function parseRating(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === '') return undefined;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(n, 5);
}

export const SORT_OPTIONS = ['relevance', 'newest', 'price-asc', 'price-desc'] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

/** Falls back rather than passing an unknown value into an orderBy. */
export function parseSort(raw: string | undefined, fallback: SortOption): SortOption {
  return (SORT_OPTIONS as readonly string[]).includes(raw ?? '')
    ? (raw as SortOption)
    : fallback;
}

/**
 * Price bounds always come as a pair; if the caller inverted them, swap rather
 * than returning an empty result set.
 */
export function parsePriceRange(
  minRaw: string | undefined,
  maxRaw: string | undefined
): { min?: number; max?: number } {
  let min = parsePriceBound(minRaw);
  let max = parsePriceBound(maxRaw);
  if (min !== undefined && max !== undefined && min > max) [min, max] = [max, min];
  return { min, max };
}
