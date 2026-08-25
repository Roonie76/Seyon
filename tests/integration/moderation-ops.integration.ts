import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { testDb, closeDatabase } from './setup';
import {
  hideReviewInTx,
  setShopSuspendedInTx,
  closeComplaintInTx,
  actionsInGesture,
} from '@/backend/lib/moderation-ops';

/**
 * Closing a complaint and acting on it, as one gesture.
 *
 * Two properties are worth proving here and are invisible from the UI.
 *
 * All of it commits or none of it does. A complaint recorded as closed "with
 * the store suspended" while the store is still live is worse than a visible
 * failure, because nobody goes back to check.
 *
 * The audit rows are not merged. One row saying "closed and suspended" cannot
 * separate the suspension reason from the closure note, and it breaks the
 * per-target history every detail page is built on — so each act writes its own
 * row and they share a correlation id instead.
 */

const PREFIX = 'mod-ops-test-';

let adminId = '';
let shopId = '';
let reviewId = '';
let reportId = '';

beforeAll(async () => {
  await testDb.$connect();
});

async function cleanup() {
  await testDb.adminAction.deleteMany({ where: { actor: { email: { startsWith: PREFIX } } } });
  await testDb.shop.deleteMany({ where: { owner: { email: { startsWith: PREFIX } } } });
  await testDb.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
}

beforeEach(async () => {
  await cleanup();

  const admin = await testDb.user.create({
    data: { email: `${PREFIX}admin@example.com`, name: 'Ops Admin', role: 'ADMIN' },
  });
  adminId = admin.id;

  const owner = await testDb.user.create({
    data: { email: `${PREFIX}owner@example.com`, name: 'Ops Owner', role: 'SELLER' },
  });
  const shop = await testDb.shop.create({
    data: {
      ownerId: owner.id, name: 'Ops Store', slug: `${PREFIX}store`,
      whatsapp: '919000000789', isListed: true, averageRating: 3, reviewCount: 2,
    },
  });
  shopId = shop.id;

  const buyer = await testDb.user.create({
    data: { email: `${PREFIX}buyer@example.com`, name: 'Ops Buyer', role: 'USER' },
  });
  const other = await testDb.user.create({
    data: { email: `${PREFIX}other@example.com`, name: 'Ops Other', role: 'USER' },
  });

  await testDb.review.create({
    data: { shopId: shop.id, userId: other.id, rating: 5, comment: 'Genuinely good, fast delivery.' },
  });
  const review = await testDb.review.create({
    data: { shopId: shop.id, userId: buyer.id, rating: 1, comment: 'This seller is a thief.' },
  });
  reviewId = review.id;

  const report = await testDb.report.create({
    data: {
      shopId: shop.id, userId: other.id, reason: 'Calls the seller a thief with no order behind it.',
      category: 'OFFENSIVE_CONTENT', targetType: 'REVIEW', reviewId: review.id,
    },
  });
  reportId = report.id;
});

afterAll(async () => {
  await cleanup();
  await closeDatabase();
});

async function reportShape() {
  const r = await testDb.report.findUniqueOrThrow({
    where: { id: reportId },
    select: { id: true, acknowledgedAt: true, createdAt: true, category: true, shop: { select: { slug: true } } },
  });
  return {
    id: r.id, acknowledgedAt: r.acknowledgedAt, createdAt: r.createdAt,
    category: r.category, shopSlug: r.shop.slug,
  };
}

describe('one gesture, several acts', () => {
  it('hides the review and closes the complaint together', async () => {
    const correlationId = 'gesture-hide-and-close';

    await testDb.$transaction(async (tx) => {
      await hideReviewInTx(tx, { reviewId, reason: 'Unfounded accusation of theft; no order exists.' }, { actorId: adminId, correlationId });
      await closeComplaintInTx(tx, { report: await reportShape(), outcome: 'RESOLVED', note: 'Review hidden; the accusation had no order behind it.' }, { actorId: adminId, correlationId });
    });

    const review = await testDb.review.findUniqueOrThrow({ where: { id: reviewId } });
    const report = await testDb.report.findUniqueOrThrow({ where: { id: reportId } });

    expect(review.isHidden).toBe(true);
    expect(report.status).toBe('RESOLVED');
    expect(report.resolvedAt).not.toBeNull();
    // Closing something never acknowledged stamps the acknowledgement rather
    // than failing the database CHECK.
    expect(report.acknowledgedAt).not.toBeNull();
  });

  it('writes one audit row per act, sharing a correlation id', async () => {
    const correlationId = 'gesture-two-rows';

    await testDb.$transaction(async (tx) => {
      await hideReviewInTx(tx, { reviewId, reason: 'Unfounded accusation of theft.' }, { actorId: adminId, correlationId });
      await closeComplaintInTx(tx, { report: await reportShape(), outcome: 'RESOLVED', note: 'Review hidden after review of the order history.' }, { actorId: adminId, correlationId });
    });

    const rows = await actionsInGesture(correlationId);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.action)).toEqual(['HIDE_REVIEW', 'RESOLVE_REPORT']);

    // Each keeps its own subject and its own words. A merged row could not.
    expect(rows[0].targetType).toBe('Review');
    expect(rows[0].reason).toContain('theft');
    expect(rows[1].targetType).toBe('Report');
  });

  it('recomputes the rating in the same transaction as the hide', async () => {
    // A review that is invisible but still counted is the worst of both worlds:
    // the seller sees the number they complained about and cannot see what
    // produces it.
    const before = await testDb.shop.findUniqueOrThrow({ where: { id: shopId } });
    expect(before.reviewCount).toBe(2);

    await testDb.$transaction(async (tx) => {
      await hideReviewInTx(tx, { reviewId, reason: 'Unfounded accusation of theft.' }, { actorId: adminId });
    });

    const after = await testDb.shop.findUniqueOrThrow({ where: { id: shopId } });
    expect(after.reviewCount).toBe(1);
    expect(after.averageRating).toBe(5);
  });

  it('rolls the whole gesture back when any part of it fails', async () => {
    // The property the composed action exists for. Anything less means a
    // complaint recorded as closed on the strength of an action that did not
    // happen.
    await expect(
      testDb.$transaction(async (tx) => {
        await hideReviewInTx(tx, { reviewId, reason: 'Unfounded accusation of theft.' }, { actorId: adminId, correlationId: 'gesture-fails' });
        await closeComplaintInTx(
          tx,
          { report: await reportShape(), outcome: 'REJECTED', note: 'Nothing wrong here.' },
          // No such actor: the audit row's foreign key fails, which must take
          // the review hiding down with it.
          { actorId: 'clnosuchuser0000000000001', correlationId: 'gesture-fails' }
        );
      })
    ).rejects.toThrow();

    const review = await testDb.review.findUniqueOrThrow({ where: { id: reviewId } });
    const report = await testDb.report.findUniqueOrThrow({ where: { id: reportId } });

    expect(review.isHidden).toBe(false);
    expect(report.resolvedAt).toBeNull();
    expect(await actionsInGesture('gesture-fails')).toHaveLength(0);
  });

  it('suspends and closes together, and the seller gets a stored notice', async () => {
    const correlationId = 'gesture-suspend';

    await testDb.$transaction(async (tx) => {
      await setShopSuspendedInTx(tx, { shopId, isSuspended: true, reason: 'Three upheld complaints in a week.' }, { actorId: adminId, correlationId });
      await closeComplaintInTx(tx, { report: await reportShape(), outcome: 'RESOLVED', note: 'Store suspended pending investigation.' }, { actorId: adminId, correlationId });
    });

    const shop = await testDb.shop.findUniqueOrThrow({ where: { id: shopId } });
    expect(shop.isSuspended).toBe(true);

    // Stored, not merely emailed. notify() no-ops when email is unconfigured,
    // so an email-only suspension could leave a seller never told.
    const notice = await testDb.notice.findFirst({ where: { shopId }, orderBy: { sentAt: 'desc' } });
    expect(notice).not.toBeNull();
    expect(notice!.kind).toBe('SUSPENSION');
    expect(notice!.emailedAt).toBeNull();
    expect(notice!.requiresResponse).toBe(true);

    expect((await actionsInGesture(correlationId)).map((r) => r.action)).toEqual([
      'SUSPEND_SHOP',
      'RESOLVE_REPORT',
    ]);
  });

  it('leaves nothing to reassemble for a plain close', async () => {
    // No correlation id when there is only one act — an id shared by one row
    // suggests a gesture that had other parts.
    await testDb.$transaction(async (tx) => {
      await closeComplaintInTx(tx, { report: await reportShape(), outcome: 'REJECTED', note: 'Looked at the order history; the review stands.' }, { actorId: adminId });
    });

    const row = await testDb.adminAction.findFirstOrThrow({ where: { targetId: reportId } });
    expect(row.action).toBe('REJECT_REPORT');
    expect((row.metadata as Record<string, unknown>).correlationId).toBeUndefined();
    // REJECT_REPORT carries a reason, in the code and in the database.
    expect(row.reason).toContain('order history');
  });

  it('hiding an already-hidden review is a no-op rather than a second row', async () => {
    await testDb.$transaction(async (tx) => {
      await hideReviewInTx(tx, { reviewId, reason: 'Unfounded accusation of theft.' }, { actorId: adminId });
    });
    const result = await testDb.$transaction(async (tx) =>
      hideReviewInTx(tx, { reviewId, reason: 'Hiding it again for some reason.' }, { actorId: adminId })
    );

    expect(result).toBeNull();
    expect(await testDb.adminAction.count({ where: { targetId: reviewId } })).toBe(1);
  });
});
