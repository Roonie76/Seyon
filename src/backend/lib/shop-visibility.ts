import type { Prisma } from '@prisma/client';

/**
 * One definition of "a buyer may see this shop".
 *
 * This used to be `{ isSuspended: false, isPaused: false }` written out by hand
 * in about twenty places — the homepage, marketplace, categories, creators,
 * search suggestions, opengraph images, the cart validator. Every new visibility
 * rule meant finding all twenty, and a single miss leaks a shop that should be
 * hidden into one surface while hiding it everywhere else. That is the shape of
 * bug nobody notices until a suspended seller emails asking why their store is
 * still in search results.
 *
 * `isListed` is exactly such a new rule: it is false until the owner completes
 * Tier 0 identity, and forgetting it on one query would put unverified stores
 * into discovery. Adding it here reaches every call site at once.
 *
 * Direct links deliberately still work for an unlisted shop — the seller must be
 * able to look at their own storefront before they have verified anything. Only
 * *discovery* is gated. Store and product pages apply `VISIBLE_SHOP` instead,
 * which drops the listing requirement but keeps suspension.
 */

/** Discovery: marketplace, search, category pages, sitemap, homepage rails. */
export const DISCOVERABLE_SHOP = {
  isSuspended: false,
  isPaused: false,
  isListed: true,
} as const satisfies Prisma.ShopWhereInput;

/**
 * Direct access: a storefront or product page reached by its URL.
 *
 * Paused is allowed through because the page has a working "currently away"
 * state — hiding it entirely returned a 404 for a shop that exists, which was
 * finding F-09 in the August audit.
 */
export const VISIBLE_SHOP = {
  isSuspended: false,
} as const satisfies Prisma.ShopWhereInput;

/** Nested form, for queries filtering products by their shop. */
export const DISCOVERABLE_SHOP_NESTED = { shop: DISCOVERABLE_SHOP } as const;
