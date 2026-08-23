'use server';

import { auth, signOut } from '@/lib/auth';
import { db } from '@/lib/db';
import { deleteFile, storagePrefixForShop } from '@/lib/supabase';
import { logger } from '../lib/logger';
import { toUserMessage } from '../lib/action-errors';
import { rateLimit, RATE_LIMITS } from '../lib/rate-limit';
import { recomputeShopRatingSafe } from '../lib/shop-ratings';
import { revalidateMarketplace, revalidateShopSurface } from '@/shared/lib/cache';

/**
 * Data-principal rights (India's DPDP Act 2023).
 *
 * A person can ask what you hold about them and can ask you to erase it. There
 * was no way to do either: shop deletion existed, account deletion did not,
 * and nothing could produce a copy of someone's data. Both are implemented
 * here rather than handled by email, because a manual process is one that
 * quietly stops happening.
 *
 * Deletion is real deletion, not a soft flag: a soft-deleted row is still a
 * row holding someone's name, email and address, which is the thing they asked
 * you to stop holding.
 */

export interface AccountExport {
  exportedAt: string;
  account: Record<string, unknown>;
  shop: Record<string, unknown> | null;
  products: Record<string, unknown>[];
  reviewsWritten: Record<string, unknown>[];
  reportsFiled: Record<string, unknown>[];
  wishlist: Record<string, unknown>[];
  activityEventCount: number;
}

/**
 * Everything Seyon holds about the signed-in person, as JSON.
 *
 * Deliberately excludes other people's personal data: a seller's export lists
 * their reviews' ratings and text, not the reviewers' names or emails.
 */
export async function exportMyData(): Promise<
  { success: true; data: AccountExport; error?: undefined } | { error: string }
> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { error: 'You must be signed in.' };
    const userId = session.user.id;

    const rl = await rateLimit(
      `account-export:${userId}`,
      RATE_LIMITS.ACCOUNT_EXPORT.limit,
      RATE_LIMITS.ACCOUNT_EXPORT.windowMs
    );
    if (!rl.success) {
      return { error: 'You have requested this a few times already. Please try again later.' };
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        shop: {
          include: {
            products: { include: { images: { select: { url: true, displayOrder: true, isPrimary: true } } } },
            reviews: { select: { rating: true, comment: true, createdAt: true } },
          },
        },
        reviews: { select: { rating: true, comment: true, createdAt: true, shop: { select: { name: true, slug: true } } } },
        reports: { select: { reason: true, status: true, createdAt: true, shop: { select: { name: true, slug: true } } } },
        wishlist: { select: { createdAt: true, product: { select: { title: true, slug: true } } } },
        _count: { select: { analytics: true } },
      },
    });

    if (!user) return { error: 'Account not found.' };

    const data: AccountExport = {
      exportedAt: new Date().toISOString(),
      account: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        address: {
          line1: user.addressLine1,
          line2: user.addressLine2,
          city: user.city,
          state: user.state,
          postalCode: user.postalCode,
          country: user.country,
        },
        joinedAt: user.createdAt,
      },
      shop: user.shop
        ? {
            name: user.shop.name,
            slug: user.shop.slug,
            description: user.shop.description,
            whatsapp: user.shop.whatsapp,
            instagram: user.shop.instagram,
            telegram: user.shop.telegram,
            city: user.shop.city,
            region: user.shop.region,
            isVerified: user.shop.isVerified,
            averageRating: user.shop.averageRating,
            reviewCount: user.shop.reviewCount,
            createdAt: user.shop.createdAt,
            // Ratings and text only — never who wrote them.
            reviewsReceived: user.shop.reviews,
          }
        : null,
      products:
        user.shop?.products.map((p) => ({
          title: p.title,
          slug: p.slug,
          description: p.description,
          price: p.price,
          compareAtPrice: p.compareAtPrice,
          category: p.category,
          options: p.options,
          status: p.status,
          inStock: p.inStock,
          createdAt: p.createdAt,
          images: p.images,
        })) ?? [],
      reviewsWritten: user.reviews,
      reportsFiled: user.reports,
      wishlist: user.wishlist,
      activityEventCount: user._count.analytics,
    };

    logger.info('Account data exported', { userId });
    return { success: true, data };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'exportMyData' }) };
  }
}

/**
 * Erase the account and everything personal attached to it.
 *
 * Requires the person to type their own email, because this is irreversible
 * and a misclick should not be able to do it.
 */
export async function deleteMyAccount(
  confirmation: string
): Promise<{ success: true; error?: undefined } | { error: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { error: 'You must be signed in.' };
    const userId = session.user.id;

    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        shop: { include: { products: { include: { images: { select: { url: true } } } } } },
        reviews: { select: { shop: { select: { id: true, slug: true } } } },
      },
    });
    if (!user) return { error: 'Account not found.' };

    if (
      !user.email ||
      confirmation.trim().toLowerCase() !== user.email.trim().toLowerCase()
    ) {
      return { error: 'That did not match the email on this account. Nothing was deleted.' };
    }

    const shop = user.shop;
    const imageUrls = shop?.products.flatMap((p) => p.images.map((i) => i.url)) ?? [];
    // Captured before the delete, because afterwards there is nothing left to
    // ask which shops this person had rated.
    const reviewedShops = [
      ...new Map(
        user.reviews.map((r) => r.shop).filter((s) => s.id !== shop?.id).map((s) => [s.id, s])
      ).values(),
    ];

    await db.$transaction(async (tx) => {
      // Reviews this person wrote go with them: the review text is their words
      // and their data. The shops they rated are re-aggregated below so no
      // cached average is left describing reviews that no longer exist.
      await tx.review.deleteMany({ where: { userId } });

      // Analytics rows already null their user reference on delete
      // (onDelete: SetNull), so aggregate traffic history survives without
      // remaining attributable to anyone.

      // Shop, products, images, wishlist, sessions and accounts all cascade
      // from the User row.
      await tx.user.delete({ where: { id: userId } });
    });

    // Deliberately after the transaction: a stale aggregate is recoverable,
    // a failed erasure is not.
    for (const reviewed of reviewedShops) {
      await recomputeShopRatingSafe(reviewed.id);
      revalidateShopSurface(reviewed.slug);
    }

    if (shop) {
      const prefix = storagePrefixForShop(shop.id);
      for (const url of imageUrls) {
        try {
          await deleteFile(url, 'products', prefix);
        } catch {
          /* orphaned files are acceptable; never block an erasure on storage */
        }
      }
      if (shop.logo) { try { await deleteFile(shop.logo, 'logos', prefix); } catch {} }
      if (shop.banner) { try { await deleteFile(shop.banner, 'banners', prefix); } catch {} }
      revalidateShopSurface(shop.slug);
      revalidateMarketplace();
    }

    logger.info('Account erased at the account holder request', {
      hadShop: Boolean(shop),
      productCount: shop?.products.length ?? 0,
    });

    // `redirect: false` on purpose. signOut with a redirect throws NEXT_REDIRECT
    // to unwind, and the catch below would swallow it and report a failure for
    // an erasure that in fact succeeded. The caller navigates instead.
    await signOut({ redirect: false });
    return { success: true };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'deleteMyAccount' }) };
  }
}
