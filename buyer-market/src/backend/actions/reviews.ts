'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ReviewSchema } from '@/lib/zod-schemas';
import { rateLimit, RATE_LIMITS } from '../lib/rate-limit';
import { notify } from '../lib/notify';
import { revalidatePath } from 'next/cache';
import { logger } from '../lib/logger';

export async function createReview(shopId: string, rawData: unknown) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return { error: 'You must be logged in to leave a review' };
    }

    const userId = session.user.id;
    if (!userId) {
      return { error: 'User ID not found in session' };
    }

    const rl = rateLimit(`review:${userId}`, RATE_LIMITS.REVIEW_CREATE.limit, RATE_LIMITS.REVIEW_CREATE.windowMs);
    if (!rl.success) {
      return { error: 'You have submitted too many reviews today. Please try again later.' };
    }

    // Verify shop exists
    const shop = await db.shop.findUnique({
      where: { id: shopId },
    });

    if (!shop) {
      return { error: 'Shop not found' };
    }

    // A seller cannot review their own shop
    if (shop.ownerId === userId) {
      return { error: 'You cannot leave a review for your own shop' };
    }

    // Review gating: only buyers who started a chat with this seller in the
    // last 90 days may review them. Keeps trust scores honest.
    const REVIEW_WINDOW_DAYS = 90;
    const recentContact = await db.analytics.findFirst({
      where: {
        shopId,
        userId,
        eventType: 'WHATSAPP_CLICK',
        createdAt: { gte: new Date(Date.now() - REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000) },
      },
      select: { id: true },
    });

    if (!recentContact) {
      return {
        error: 'Reviews are limited to buyers who have contacted this seller. Tap "Chat on WhatsApp" first, then come back to share your experience.',
      };
    }

    const validated = ReviewSchema.safeParse(rawData);
    if (!validated.success) {
      return { error: validated.error.issues[0].message };
    }

    // Check if user has already reviewed this shop
    const existingReview = await db.review.findUnique({
      where: {
        shopId_userId: {
          shopId,
          userId,
        },
      },
    });

    // One review per user per shop — resubmitting updates the existing review.
    const review = existingReview
      ? await db.review.update({
          where: { shopId_userId: { shopId, userId } },
          data: {
            rating: validated.data.rating,
            comment: validated.data.comment,
          },
          include: {
            user: { select: { name: true, image: true } },
          },
        })
      : await db.review.create({
          data: {
            shopId,
            userId,
            rating: validated.data.rating,
            comment: validated.data.comment,
          },
          include: {
            user: { select: { name: true, image: true } },
          },
        });
    const isUpdate = Boolean(existingReview);

    // Notify the seller (fire-and-forget; never blocks the response)
    db.user
      .findUnique({ where: { id: shop.ownerId }, select: { email: true } })
      .then((owner) => {
        if (owner?.email) {
          return notify({
            to: owner.email,
            subject: `New ${validated.data.rating}-star review on ${shop.name}`,
            text: `Your storefront "${shop.name}" just received a new review on Seyon.\n\nRating: ${validated.data.rating}/5\nComment: "${validated.data.comment}"\n\nView your reviews: ${process.env.NEXT_PUBLIC_SITE_URL || ''}/store/${shop.slug}`,
          });
        }
      })
      .catch(() => undefined);

    revalidatePath(`/store/${shop.slug}`);
    revalidatePath('/dashboard');
    return { success: true, review, updated: isUpdate };
  } catch (error) {
    logger.error('Error creating review', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return { error: errorMessage };
  }
}
