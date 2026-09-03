import { db } from '@/lib/db';
import { ReportStatus, type Prisma } from '@prisma/client';
import { recordAdminAction, ADMIN_ACTIONS } from './admin-audit';
import { recomputeShopRating } from './shop-ratings';
import { issueNotice } from './notices';

/** How long a suspended seller has to appeal before the notice reads as overdue. */
const SUSPENSION_APPEAL_DAYS = 14;

/**
 * The transactional core of each moderation act, separated from the action that
 * wraps it.
 *
 * Closing a complaint and acting on it should happen together — a moderator who
 * decides a review is abusive should not have to close the complaint, navigate
 * to the store, hide the review, and hope nothing interrupts them in between.
 * But "together" has to mean one transaction, and the standalone actions each
 * open their own, re-check authorisation and re-run the rate limiter.
 *
 * So the work lives here, taking a transaction client, and both callers use it:
 * the single-purpose actions, and the composed close-and-act path. There is
 * exactly one definition of what hiding a review does.
 *
 * ## Correlation
 *
 * Each act still writes its own audit row. One row saying "closed and
 * suspended" reads well and answers nothing — it cannot say what the
 * suspension reason was as distinct from the closure note, and it breaks the
 * per-target history that `auditTrailFor` depends on. Instead every row from
 * one gesture carries the same `correlationId` in its metadata, so the rows can
 * be reassembled without being merged.
 */

export interface ModerationOpContext {
  actorId: string;
  /** Shared by every audit row written by a single admin gesture. */
  correlationId?: string;
}

function withCorrelation(
  metadata: Record<string, unknown>,
  ctx: ModerationOpContext
): Prisma.InputJsonValue {
  return (ctx.correlationId
    ? { ...metadata, correlationId: ctx.correlationId }
    : metadata) as Prisma.InputJsonValue;
}

/**
 * Hide a review, recompute the rating, record it.
 *
 * The rating is recomputed inside the same transaction, because a review that
 * is invisible but still counted is the worst of both worlds: the seller sees
 * the number they complained about and cannot see what produces it.
 *
 * Returns null when there was nothing to do, so a caller can tell "already
 * hidden" from "hidden just now" without a second query.
 */
export async function hideReviewInTx(
  tx: Prisma.TransactionClient,
  input: { reviewId: string; reason: string },
  ctx: ModerationOpContext
): Promise<{ shopId: string; shopSlug: string } | null> {
  const review = await tx.review.findUnique({
    where: { id: input.reviewId },
    select: { id: true, shopId: true, rating: true, isHidden: true, shop: { select: { slug: true } } },
  });
  if (!review) throw new Error('Review not found.');
  if (review.isHidden) return null;

  await tx.review.update({
    where: { id: review.id },
    data: {
      isHidden: true,
      hiddenAt: new Date(),
      hiddenReason: input.reason,
      hiddenById: ctx.actorId,
    },
  });

  await recordAdminAction(
    {
      actorId: ctx.actorId,
      action: ADMIN_ACTIONS.HIDE_REVIEW,
      targetType: 'Review',
      targetId: review.id,
      reason: input.reason,
      metadata: withCorrelation({ shopId: review.shopId, rating: review.rating }, ctx),
    },
    tx
  );

  await recomputeShopRating(review.shopId, tx);

  return { shopId: review.shopId, shopSlug: review.shop.slug };
}

/**
 * Suspend or reinstate a store, and write the seller their copy.
 *
 * The notice is stored rather than only emailed. `notify()` no-ops entirely
 * when email is unconfigured, so the previous fire-and-forget email meant a
 * seller could lose their storefront and never be told, with nothing recording
 * that we had tried. The returned notice id is emailed by the caller, outside
 * the transaction.
 */
export async function setShopSuspendedInTx(
  tx: Prisma.TransactionClient,
  input: { shopId: string; isSuspended: boolean; reason?: string },
  ctx: ModerationOpContext
): Promise<{ shopId: string; shopSlug: string; shopName: string; noticeId: string }> {
  const { isSuspended } = input;
  const reason = input.reason?.trim();

  const updated = await tx.shop.update({
    where: { id: input.shopId },
    data: { isSuspended },
  });

  await recordAdminAction(
    {
      actorId: ctx.actorId,
      action: isSuspended ? ADMIN_ACTIONS.SUSPEND_SHOP : ADMIN_ACTIONS.UNSUSPEND_SHOP,
      targetType: 'Shop',
      targetId: updated.id,
      reason: isSuspended ? reason : (reason ?? 'Reinstated'),
      metadata: withCorrelation({ slug: updated.slug, isSuspended }, ctx),
    },
    tx
  );

  const notice = await issueNotice(
    {
      shopId: updated.id,
      actorId: ctx.actorId,
      kind: isSuspended ? 'SUSPENSION' : 'REINSTATEMENT',
      subject: isSuspended
        ? `Your storefront "${updated.name}" has been suspended`
        : `Your storefront "${updated.name}" has been reinstated`,
      body: isSuspended
        ? `Your storefront "${updated.name}" is no longer visible to buyers.\n\n` +
          `Reason given by the reviewer:\n${reason}\n\n` +
          'If you believe this is a mistake, reply to this notice with anything that shows it.'
        : `Your storefront "${updated.name}" is visible to buyers again.` +
          (reason ? `\n\nNote from the reviewer:\n${reason}` : ''),
      requiresResponse: isSuspended,
      /**
       * A suspension appeal gets a date, in both directions.
       *
       * `issueNotice` stores null when none is given, so a suspension could
       * never be `overdue` — it sat in `awaiting` forever. Worse, the seller
       * was handed a reply box with no stated turnaround from either side while
       * their store was offline. Fourteen days is what we ask of them; the
       * "replied, not reviewed" queue is what holds us to our half.
       */
      respondBy: isSuspended
        ? new Date(Date.now() + SUSPENSION_APPEAL_DAYS * 86_400_000)
        : null,
    },
    tx
  );

  return { shopId: updated.id, shopSlug: updated.slug, shopName: updated.name, noticeId: notice.id };
}

/**
 * Close a complaint, either way.
 *
 * `REJECTED` exists so "we looked and found nothing" is recordable separately
 * from "we acted". Folding them together would leave a seller with a permanent
 * count of resolved complaints nobody could distinguish from upheld ones.
 */
export async function closeComplaintInTx(
  tx: Prisma.TransactionClient,
  input: {
    report: { id: string; acknowledgedAt: Date | null; createdAt: Date; category: string; shopSlug: string };
    outcome: 'RESOLVED' | 'REJECTED';
    note: string;
  },
  ctx: ModerationOpContext
): Promise<void> {
  const { report, outcome, note } = input;
  const now = new Date();

  await tx.report.update({
    where: { id: report.id },
    data: {
      status: outcome === 'RESOLVED' ? ReportStatus.RESOLVED : ReportStatus.REJECTED,
      resolvedAt: now,
      resolutionNote: note,
      // The database refuses a disposal that was never acknowledged. Closing
      // something the same hour it arrived is legitimate — stamp the
      // acknowledgement rather than failing the close.
      ...(report.acknowledgedAt ? {} : { acknowledgedAt: now, acknowledgedById: ctx.actorId }),
    },
  });

  await recordAdminAction(
    {
      actorId: ctx.actorId,
      action: outcome === 'RESOLVED' ? ADMIN_ACTIONS.RESOLVE_REPORT : ADMIN_ACTIONS.REJECT_REPORT,
      targetType: 'Report',
      targetId: report.id,
      // REJECT_REPORT requires a reason, in the code and in the database.
      reason: outcome === 'REJECTED' ? note : null,
      metadata: withCorrelation(
        {
          shopSlug: report.shopSlug,
          category: report.category,
          daysAfterReceipt: Math.round((now.getTime() - report.createdAt.getTime()) / 86_400_000),
        },
        ctx
      ),
    },
    tx
  );
}

/**
 * Everything one gesture did, reassembled.
 *
 * The rows were never merged, so this reads them back by the shared id rather
 * than parsing a compound action name.
 */
export async function actionsInGesture(correlationId: string) {
  return db.adminAction.findMany({
    where: { metadata: { path: ['correlationId'], equals: correlationId } },
    orderBy: { createdAt: 'asc' },
    include: { actor: { select: { name: true, email: true } } },
  });
}
