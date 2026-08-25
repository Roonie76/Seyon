import { db } from '@/lib/db';

/**
 * Where a store used to live.
 *
 * When an admin corrects a store's address, every link the seller has already
 * shared — in WhatsApp messages, on Instagram, in a buyer's bookmarks — points
 * at the old one. Those links are the marketplace's traffic, and losing them
 * quietly is the worst kind of breakage: nothing errors, the numbers just go
 * down and nobody connects it to a tidy-up three weeks earlier.
 *
 * So the old address is kept and resolved to the current one. This is only
 * consulted after a live lookup has already missed, so it costs nothing on the
 * path everybody takes.
 */
export async function currentSlugFor(oldSlug: string): Promise<string | null> {
  const clean = oldSlug.trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(clean)) return null;

  const history = await db.shopSlugHistory.findUnique({
    where: { slug: clean },
    select: { shop: { select: { slug: true } } },
  });

  // A history row whose shop has since been deleted resolves to nothing, which
  // is correct: there is no longer anywhere to send the visitor.
  return history?.shop.slug ?? null;
}
