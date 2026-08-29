import { cache } from 'react';
import { db } from '@/lib/db';
import { PUBLIC_REVIEW } from './shop-visibility';

/**
 * The public storefront, in one query per request.
 *
 * Two things were wrong with this and both cost the same page twice over.
 *
 * It ran twice: `generateMetadata` and the page component each called it, and
 * nothing deduplicated them, so every storefront view issued the whole join
 * twice. `cache()` is React's per-request memo — same arguments, one call.
 *
 * And it was unbounded in three directions at once: every product, every
 * image of every product, and every review ever left. The page uses only
 * `images[0]` per card, and shows the review total from the stored aggregate
 * rather than by counting the rows, so both of those fan-outs were paid for
 * and thrown away. Products are capped too, but at one more than the limit,
 * so the page can say when it is showing a subset rather than quietly hiding
 * a seller's stock.
 */
export const STOREFRONT_PRODUCT_LIMIT = 200;
export const STOREFRONT_REVIEW_LIMIT = 24;

export const getShopBySlug = cache(async function getShopBySlug(slug: string) {
  const cleanSlug = slug.trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(cleanSlug)) {
    return null;
  }

  const shop = await db.shop.findUnique({
    where: { slug: cleanSlug },
    include: {
      _count: {
        select: { products: true },
      },
      owner: {
        select: {
          emailVerified: true,
          phone: true,
          createdAt: true,
          // Seller identity, shown publicly because the Consumer Protection
          // (E-Commerce) Rules 2020 require a marketplace to display each
          // seller's legal name and principal geographic address. Nothing else
          // about the owner is exposed here — no email, no account id.
          addressLine1: true,
          addressLine2: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
          sellerKyc: { select: { legalName: true, status: true } },
        },
      },
      products: {
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        // One past the limit, so the caller can tell "exactly 200" from
        // "more than 200" without a second count.
        take: STOREFRONT_PRODUCT_LIMIT + 1,
        include: {
          images: {
            orderBy: { displayOrder: 'asc' },
            // The storefront grid renders `images[0]` and nothing else.
            take: 1,
          },
        },
      },
      reviews: {
        // Hidden reviews are excluded here as well as from the rating. One that
        // still appeared on the storefront would make hiding it pointless; one
        // that appeared but was not counted would make the displayed rating
        // look wrong to anyone adding the stars up themselves.
        where: PUBLIC_REVIEW,
        orderBy: { createdAt: 'desc' },
        // The displayed total comes from `Shop.reviewCount`, so bounding the
        // rows changes what is listed, not what is claimed.
        take: STOREFRONT_REVIEW_LIMIT,
        include: {
          user: {
            select: { name: true, image: true },
          },
        },
      },
      reports: {
        where: { status: 'OPEN' },
        select: {
          id: true, // Only select ID to prevent leaking PII (userId, reason) to the public storefront
        },
      },
    },
  });
  if (!shop) return null;
  // Mask the owner's phone number to protect personal privacy, preserving type check phone !== null
  if (shop.owner) {
    shop.owner.phone = shop.owner.phone ? 'hidden' : null;
  }
  return shop;
});
