'use server';

import { getSession } from '@/backend/lib/session';
import { db } from '@/lib/db';
import { ReportTarget } from '@prisma/client';
import { ReportSchema } from '@/lib/zod-schemas';
import { rateLimit, RATE_LIMITS } from '../lib/rate-limit';
import { revalidatePath } from 'next/cache';
import { logger } from '../lib/logger';
import { revalidateShopSurface } from '@/shared/lib/cache';

export async function createReport(shopId: string, rawData: unknown) {
  try {
    const session = await getSession();
    if (!session || !session.user) {
      return { error: 'You must be logged in to file a report' };
    }

    const userId = session.user.id;
    if (!userId) {
      return { error: 'User ID not found in session' };
    }

    const rl = await rateLimit(`report:${userId}`, RATE_LIMITS.REPORT_CREATE.limit, RATE_LIMITS.REPORT_CREATE.windowMs);
    if (!rl.success) {
      return { error: 'You have filed too many reports today. Please try again later.' };
    }

    // Verify shop exists
    const shop = await db.shop.findUnique({
      where: { id: shopId },
    });

    if (!shop) {
      return { error: 'Shop not found' };
    }

    const validated = ReportSchema.safeParse(rawData);
    if (!validated.success) {
      return { error: validated.error.issues[0].message };
    }

    // A complaint about a review, rather than about the store itself. The
    // review still belongs to this shop, so `shopId` is set either way: a
    // review complaint is also a signal about the store, and the queue's
    // "how many open against this store" count should include it.
    let reviewId: string | undefined;
    if (validated.data.reviewId) {
      const review = await db.review.findUnique({
        where: { id: validated.data.reviewId },
        select: { id: true, shopId: true, userId: true, isHidden: true },
      });

      if (!review || review.shopId !== shopId) {
        return { error: 'That review is not on this store.' };
      }

      // Reporting your own review is either a mistake or an attempt to get it
      // removed without deleting it, and neither needs a moderator.
      if (review.userId === userId) {
        return { error: 'You cannot report your own review. Edit or replace it instead.' };
      }

      // Already hidden: nothing for a moderator to decide, and a queue full of
      // complaints about invisible reviews buries the ones that matter.
      if (review.isHidden) {
        return { error: 'That review is already hidden and is not visible to buyers.' };
      }

      const existing = await db.report.findFirst({
        where: { reviewId: review.id, userId },
        select: { id: true },
      });
      if (existing) {
        return { error: 'You have already reported this review. It is with a moderator.' };
      }

      reviewId = review.id;
    }

    const report = await db.report.create({
      data: {
        shopId,
        userId,
        category: validated.data.category,
        reason: validated.data.reason,
        targetType: reviewId ? ReportTarget.REVIEW : ReportTarget.SHOP,
        reviewId,
      },
    });

    revalidateShopSurface(shop.slug);
    revalidatePath('/admin');
    return { success: true, report };
  } catch (error) {
    logger.error('Error creating report', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return { error: errorMessage };
  }
}
