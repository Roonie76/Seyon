'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { recordAdminAction, ADMIN_ACTIONS, auditTrailFor, type AuditEntry } from '../lib/admin-audit';
import { recomputeShopRating } from '../lib/shop-ratings';
import { requireAdmin } from '../lib/require-admin';
import { toUserMessage } from '../lib/action-errors';
import { revalidateShopSurface, revalidateMarketplace } from '@/shared/lib/cache';

/**
 * Moderating a review without destroying it, and de-ranking a store without
 * accusing it.
 *
 * Both actions here replace something that previously had only a destructive
 * form: a bad review could only be deleted, and a suspicious store could only
 * be suspended. Both of those are verdicts, and moderation mostly happens
 * before anyone is entitled to a verdict.
 */

const IdSchema = z.string().cuid('Invalid identifier');
const ReasonSchema = z
  .string()
  .trim()
  .min(10, 'Say what is wrong with it — at least a sentence.')
  .max(1000, 'Keep the reason under 1000 characters.');

type Result = { success: true; error?: undefined } | { success?: undefined; error: string };

/**
 * Hide a review.
 *
 * The rating is recomputed inside the same transaction as the hide, because a
 * review that is invisible but still counted is the worst of both worlds: the
 * seller sees the number they complained about and cannot see what is producing
 * it.
 */
export async function hideReviewAction(reviewId: string, reason: string): Promise<Result> {
  try {
    const id = IdSchema.safeParse(reviewId);
    if (!id.success) return { error: 'Invalid review id.' };

    const parsedReason = ReasonSchema.safeParse(reason);
    if (!parsedReason.success) return { error: parsedReason.error.issues[0].message };

    const { actorId } = await requireAdmin();

    const review = await db.review.findUnique({
      where: { id: id.data },
      select: { id: true, shopId: true, rating: true, isHidden: true, shop: { select: { slug: true } } },
    });
    if (!review) return { error: 'Review not found.' };
    if (review.isHidden) return { success: true };

    await db.$transaction(async (tx) => {
      await tx.review.update({
        where: { id: review.id },
        data: {
          isHidden: true,
          hiddenAt: new Date(),
          hiddenReason: parsedReason.data,
          hiddenById: actorId,
        },
      });
      await recordAdminAction(
        {
          actorId,
          action: ADMIN_ACTIONS.HIDE_REVIEW,
          targetType: 'Review',
          targetId: review.id,
          reason: parsedReason.data,
          metadata: { shopId: review.shopId, rating: review.rating },
        },
        tx
      );
      await recomputeShopRating(review.shopId, tx);
    });

    revalidateShopSurface(review.shop.slug);
    revalidateMarketplace();
    revalidatePath('/admin', 'layout');
    return { success: true };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'hideReview' }) };
  }
}

/** Put a hidden review back. No reason required — undoing a mistake should be cheap. */
export async function unhideReviewAction(reviewId: string): Promise<Result> {
  try {
    const id = IdSchema.safeParse(reviewId);
    if (!id.success) return { error: 'Invalid review id.' };

    const { actorId } = await requireAdmin();

    const review = await db.review.findUnique({
      where: { id: id.data },
      select: { id: true, shopId: true, isHidden: true, hiddenReason: true, shop: { select: { slug: true } } },
    });
    if (!review) return { error: 'Review not found.' };
    if (!review.isHidden) return { success: true };

    await db.$transaction(async (tx) => {
      await tx.review.update({
        where: { id: review.id },
        data: { isHidden: false, hiddenAt: null, hiddenReason: null, hiddenById: null },
      });
      await recordAdminAction(
        {
          actorId,
          action: ADMIN_ACTIONS.UNHIDE_REVIEW,
          targetType: 'Review',
          targetId: review.id,
          // Carry the old reason forward so the trail still explains why it was
          // hidden in the first place after the column is cleared.
          metadata: { shopId: review.shopId, previousReason: review.hiddenReason },
        },
        tx
      );
      await recomputeShopRating(review.shopId, tx);
    });

    revalidateShopSurface(review.shop.slug);
    revalidateMarketplace();
    revalidatePath('/admin', 'layout');
    return { success: true };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'unhideReview' }) };
  }
}

/**
 * Put a store under review, or take it out again.
 *
 * Under review means: gone from discovery, still reachable by link, nothing
 * said to the shopper. The seller is not emailed either — this is the state for
 * "we are looking into an accusation we have not tested", and telling the
 * subject of an investigation before you have looked is how evidence
 * disappears. If you have concluded something, suspend and say so, or send a
 * notice.
 */
export async function setShopUnderReviewAction(
  shopId: string,
  underReview: boolean,
  reason?: string
): Promise<Result> {
  try {
    const id = IdSchema.safeParse(shopId);
    if (!id.success) return { error: 'Invalid shop id.' };

    let parsedReason: string | null = null;
    if (underReview) {
      const r = ReasonSchema.safeParse(reason ?? '');
      if (!r.success) return { error: r.error.issues[0].message };
      parsedReason = r.data;
    }

    const { actorId } = await requireAdmin();

    const shop = await db.shop.findUnique({
      where: { id: id.data },
      select: { id: true, slug: true, isUnderReview: true, underReviewReason: true },
    });
    if (!shop) return { error: 'Store not found.' };
    if (shop.isUnderReview === underReview) return { success: true };

    await db.$transaction(async (tx) => {
      await tx.shop.update({
        where: { id: shop.id },
        data: underReview
          ? {
              isUnderReview: true,
              underReviewReason: parsedReason,
              underReviewSince: new Date(),
              underReviewById: actorId,
            }
          : {
              isUnderReview: false,
              underReviewReason: null,
              underReviewSince: null,
              underReviewById: null,
            },
      });
      await recordAdminAction(
        {
          actorId,
          action: underReview ? ADMIN_ACTIONS.MARK_UNDER_REVIEW : ADMIN_ACTIONS.CLEAR_UNDER_REVIEW,
          targetType: 'Shop',
          targetId: shop.id,
          reason: parsedReason,
          metadata: { slug: shop.slug, previousReason: shop.underReviewReason },
        },
        tx
      );
    });

    revalidateShopSurface(shop.slug);
    revalidateMarketplace();
    revalidatePath('/admin', 'layout');
    return { success: true };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'setShopUnderReview' }) };
  }
}

export interface ModeratedReview {
  id: string;
  rating: number;
  comment: string;
  createdAt: Date;
  authorName: string | null;
  isHidden: boolean;
  hiddenAt: Date | null;
  hiddenReason: string | null;
  hiddenByName: string | null;
  audit: AuditEntry[];
}

/** Reviews for one shop, hidden ones included, for the admin store page. */
export async function getShopReviewsForModeration(
  shopId: string
): Promise<{ data: ModeratedReview[] } | { error: string }> {
  try {
    await requireAdmin();

    const id = IdSchema.safeParse(shopId);
    if (!id.success) return { error: 'Invalid shop id.' };

    const rows = await db.review.findMany({
      where: { shopId: id.data },
      orderBy: [{ isHidden: 'asc' }, { createdAt: 'desc' }],
      take: 100,
      include: {
        user: { select: { name: true } },
        hiddenBy: { select: { name: true } },
      },
    });

    // One audit query per review would be N+1 on a busy store; fetch the whole
    // set for these ids at once and bucket in memory.
    const trails = await Promise.all(rows.filter((r) => r.isHidden).map((r) => auditTrailFor('Review', r.id, 10)));
    const trailByTarget = new Map<string, AuditEntry[]>();
    trails.flat().forEach((entry) => {
      const list = trailByTarget.get(entry.targetId) ?? [];
      list.push(entry);
      trailByTarget.set(entry.targetId, list);
    });

    return {
      data: rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        authorName: r.user?.name ?? null,
        isHidden: r.isHidden,
        hiddenAt: r.hiddenAt,
        hiddenReason: r.hiddenReason,
        hiddenByName: r.hiddenBy?.name ?? null,
        audit: trailByTarget.get(r.id) ?? [],
      })),
    };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'getShopReviewsForModeration' }) };
  }
}
