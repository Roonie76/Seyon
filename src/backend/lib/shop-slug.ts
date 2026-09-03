import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';

/**
 * Claiming a storefront address, and retiring the one it replaces.
 *
 * Two paths change a shop's slug — the admin repair tool and the seller's own
 * settings form — and only one of them did it correctly. The admin path checked
 * both the live table and the history table for a clash, and wrote a history row
 * inside a transaction before taking the new address. The seller path checked
 * `Shop.slug` alone and wrote nothing, which had two consequences:
 *
 *   1. Every link the seller had ever shared died silently. `currentSlugFor` had
 *      no row to find, so the old address resolved to nothing — every WhatsApp
 *      forward, Instagram bio link and printed QR code, gone, with no error
 *      anywhere and no way to recover the slug once somebody else took it.
 *
 *   2. A retired address could be claimed by a different store. The schema says
 *      the opposite in as many words — "unique across all history, so a freed
 *      slug cannot be given to another store and silently redirect its traffic
 *      somewhere else" — and the seller endpoints broke that invariant. The live
 *      lookup finds the new claimant before the redirect table is ever consulted,
 *      so the original store's shared links land on someone else's storefront
 *      and someone else's WhatsApp number.
 *
 * One helper, called by both paths, so the rule cannot be true in one place and
 * false in the other.
 */

/** Is this address free for `shopId` to take? Returns a message when it is not. */
export async function slugClashReason(slug: string, shopId: string): Promise<string | null> {
  const [liveClash, historicClash] = await Promise.all([
    db.shop.findUnique({ where: { slug }, select: { id: true } }),
    db.shopSlugHistory.findUnique({ where: { slug }, select: { shopId: true } }),
  ]);

  if (liveClash && liveClash.id !== shopId) {
    return 'This storefront URL handle is already taken';
  }
  if (historicClash && historicClash.shopId !== shopId) {
    return 'That address used to belong to a different store, so it cannot be reused.';
  }
  return null;
}

/**
 * The same check for a store that does not exist yet.
 *
 * `createShop` only looked at live shops too, so a brand-new store could take a
 * retired address and inherit its traffic on day one.
 */
export async function slugClashReasonForNewShop(slug: string): Promise<string | null> {
  const [liveClash, historicClash] = await Promise.all([
    db.shop.findUnique({ where: { slug }, select: { id: true } }),
    db.shopSlugHistory.findUnique({ where: { slug }, select: { shopId: true } }),
  ]);

  if (liveClash) return 'This storefront URL handle is already taken';
  if (historicClash) {
    return 'That address used to belong to a different store, so it cannot be reused.';
  }
  return null;
}

/**
 * Retire the address a shop is moving away from.
 *
 * Written before the shop row is updated and inside the same transaction, so a
 * crash between the two cannot leave the store unreachable at either address.
 * `upsert` rather than `create` because a store may return to an address it
 * held before, and the history row for it is already there.
 */
export async function retireSlug(
  tx: Prisma.TransactionClient,
  shopId: string,
  oldSlug: string,
  changedById: string | null
): Promise<void> {
  await tx.shopSlugHistory.upsert({
    where: { slug: oldSlug },
    update: {},
    create: { shopId, slug: oldSlug, changedById },
  });
}
