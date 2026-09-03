import { Prisma } from '@prisma/client';

/**
 * Exactly what the seller's own screens may see of their shop.
 *
 * The dashboard used to load the bare row — `findUnique` with no `select` —
 * and pass it to `StoreSettingsForm`, which is a client component. Everything
 * crossing that boundary is serialized into the payload the browser downloads,
 * so `isUnderReview`, `underReviewSince`, `underReviewById` and the moderator's
 * free-text `underReviewReason` were all sitting in view-source.
 *
 * The schema's own comment on that column says why this matters: a visible
 * "under review" convicts a seller on an accusation that may be false, while
 * warning a real fraudster to move on. The flag exists to be invisible to its
 * subject, and one missing `select` made it the opposite.
 *
 * An allowlist rather than an omission list, and a named type rather than
 * `Shop`, because the failure mode is the *next* moderation column somebody
 * adds. With this, a new private field is invisible by default and has to be
 * deliberately added here to leak.
 *
 * Everything in here is the seller's own business to know — including
 * `isSuspended` and `isListed`, which they are told about directly.
 */
export const SELLER_SHOP_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  logo: true,
  banner: true,
  whatsapp: true,
  whatsappVerifiedAt: true,
  whatsappVerifiedVia: true,
  instagram: true,
  telegram: true,
  city: true,
  region: true,
  deliveryNote: true,
  isPaused: true,
  isVerified: true,
  isSuspended: true,
  isListed: true,
  averageRating: true,
  reviewCount: true,
  updatedAt: true,
} as const satisfies Prisma.ShopSelect;

export type SellerShopView = Prisma.ShopGetPayload<{
  select: typeof SELLER_SHOP_SELECT;
}>;

/**
 * How many reviews and reports the dashboard renders.
 *
 * Both relations were loaded unbounded, with the author join, on a
 * `force-dynamic` page that `LiveRefresh` re-runs every sixty seconds per open
 * tab — so a store with a few thousand reviews re-fetched all of them sixty
 * times an hour to fill about 350px of scrollable panel. The totals shown in
 * the header come from the denormalised counters, not from counting these.
 */
export const DASHBOARD_FEED_LIMIT = 20;
