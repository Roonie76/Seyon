import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { logger } from './logger';

/**
 * Single source of truth for a shop's rating.
 *
 * There were two before: store and product pages summed `shop.reviews` live,
 * while marketplace filters, creator cards and the homepage read the
 * denormalised `Shop.averageRating` / `reviewCount`. Those two answers could
 * disagree — the denormalised pair was only ever recalculated inside
 * `createReview`, so deleting a review (or cascading a user delete) left it
 * permanently stale, and a shop could be filtered in at "4+ stars" while its
 * own page displayed 3.2.
 *
 * Everything now reads the stored columns, and every path that changes a
 * review calls `recomputeShopRating`.
 */

export interface ShopRating {
  averageRating: number;
  reviewCount: number;
}

/** Recalculate and persist the cached aggregates for one shop. */
export async function recomputeShopRating(
  shopId: string,
  client: Prisma.TransactionClient | typeof db = db
): Promise<ShopRating> {
  const agg = await client.review.aggregate({
    where: { shopId },
    _avg: { rating: true },
    _count: { _all: true },
  });

  const reviewCount = agg._count._all;
  // Rounded to one decimal so the stored value matches what is displayed and
  // what the "4+ stars" filter compares against.
  const averageRating = reviewCount > 0 ? Math.round((agg._avg.rating ?? 0) * 10) / 10 : 0;

  await client.shop.update({
    where: { id: shopId },
    data: { averageRating, reviewCount },
  });

  return { averageRating, reviewCount };
}

/**
 * Best-effort variant for paths where a stale aggregate is preferable to
 * failing the operation the user actually asked for.
 */
export async function recomputeShopRatingSafe(shopId: string): Promise<void> {
  try {
    await recomputeShopRating(shopId);
  } catch (err) {
    logger.error('Failed to recompute cached shop rating', err, { shopId });
  }
}

/** Display helper: null when there is nothing real to show. */
export function displayRating(shop: {
  averageRating?: number | null;
  reviewCount?: number | null;
}): number | null {
  if (!shop.reviewCount || shop.reviewCount <= 0) return null;
  return shop.averageRating && shop.averageRating > 0 ? shop.averageRating : null;
}
