import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { testDb, closeDatabase } from './setup';
import { ReportStatus, ReportCategory, NoticeKind } from '@prisma/client';
import { recomputeShopRating } from '@/backend/lib/shop-ratings';
import { actionRequiresReason, ADMIN_ACTIONS } from '@/backend/lib/admin-audit';
import { DISCOVERABLE_SHOP, VISIBLE_SHOP } from '@/backend/lib/shop-visibility';

/**
 * Moderation, complaints and notices against a real database.
 *
 * The rating recomputation is the one worth having here rather than as a unit
 * test: it is an aggregate query with a `where` clause, and the failure mode is
 * that the clause silently does nothing — which a mocked Prisma client would
 * happily reproduce as a pass.
 */

const PREFIX = 'mod-test-';

let adminId = '';
let ownerId = '';
let shopId = '';
const buyerIds: string[] = [];

beforeAll(async () => {
  await testDb.$connect();
});

async function wipe() {
  await testDb.adminAction.deleteMany({ where: { actor: { email: { startsWith: PREFIX } } } });
  await testDb.notice.deleteMany({ where: { shop: { slug: { startsWith: PREFIX } } } });
  await testDb.report.deleteMany({ where: { shop: { slug: { startsWith: PREFIX } } } });
  await testDb.review.deleteMany({ where: { shop: { slug: { startsWith: PREFIX } } } });
  await testDb.shop.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await testDb.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
}

beforeEach(async () => {
  await wipe();
  buyerIds.length = 0;

  const admin = await testDb.user.create({
    data: { email: `${PREFIX}admin@example.com`, name: 'Mod Admin', role: 'ADMIN' },
  });
  adminId = admin.id;

  const owner = await testDb.user.create({
    data: { email: `${PREFIX}owner@example.com`, name: 'Mod Owner', role: 'SELLER' },
  });
  ownerId = owner.id;

  const shop = await testDb.shop.create({
    data: {
      ownerId,
      name: 'Mod Test Store',
      slug: `${PREFIX}store`,
      whatsapp: '919700000009',
      isListed: true,
    },
  });
  shopId = shop.id;

  // Four reviews: 5, 5, 5, 1. Average 4.0 with all of them, 5.0 without the 1.
  for (const [i, rating] of [5, 5, 5, 1].entries()) {
    const buyer = await testDb.user.create({
      data: { email: `${PREFIX}buyer${i}@example.com`, name: `Buyer ${i}` },
    });
    buyerIds.push(buyer.id);
    await testDb.review.create({
      data: { shopId, userId: buyer.id, rating, comment: `Review number ${i}` },
    });
  }
});

afterAll(async () => {
  await wipe();
  await closeDatabase();
});

describe('hiding a review', () => {
  it('changes the rating, which is the entire point of hiding rather than deleting', async () => {
    const before = await recomputeShopRating(shopId);
    expect(before.averageRating).toBe(4);
    expect(before.reviewCount).toBe(4);

    const oneStar = await testDb.review.findFirstOrThrow({ where: { shopId, rating: 1 } });
    await testDb.review.update({
      where: { id: oneStar.id },
      data: { isHidden: true, hiddenAt: new Date(), hiddenReason: 'Defamatory, unrelated to any purchase.', hiddenById: adminId },
    });

    const after = await recomputeShopRating(shopId);
    expect(after.averageRating).toBe(5);
    expect(after.reviewCount).toBe(3);
  });

  it('keeps the review itself, so the decision can be checked later', async () => {
    const oneStar = await testDb.review.findFirstOrThrow({ where: { shopId, rating: 1 } });
    await testDb.review.update({
      where: { id: oneStar.id },
      data: { isHidden: true, hiddenAt: new Date(), hiddenReason: 'Defamatory, unrelated to any purchase.', hiddenById: adminId },
    });

    const still = await testDb.review.findUnique({ where: { id: oneStar.id } });
    expect(still?.comment).toBe(oneStar.comment);
    expect(still?.hiddenReason).toContain('Defamatory');
  });

  it('refuses a hide with no reason', async () => {
    const r = await testDb.review.findFirstOrThrow({ where: { shopId, rating: 1 } });
    await expect(
      testDb.review.update({ where: { id: r.id }, data: { isHidden: true, hiddenAt: new Date() } })
    ).rejects.toThrow();
  });

  it('refuses a hide with no timestamp', async () => {
    const r = await testDb.review.findFirstOrThrow({ where: { shopId, rating: 1 } });
    await expect(
      testDb.review.update({ where: { id: r.id }, data: { isHidden: true, hiddenReason: 'Something or other' } })
    ).rejects.toThrow();
  });

  it('keeps the moderator on record but survives their account being deleted', async () => {
    const r = await testDb.review.findFirstOrThrow({ where: { shopId, rating: 1 } });
    await testDb.review.update({
      where: { id: r.id },
      data: { isHidden: true, hiddenAt: new Date(), hiddenReason: 'Defamatory, unrelated to any purchase.', hiddenById: adminId },
    });

    // SetNull, not Cascade: removing an admin must not delete the reviews they
    // moderated along with them.
    await testDb.user.delete({ where: { id: adminId } });
    const after = await testDb.review.findUnique({ where: { id: r.id } });
    expect(after).not.toBeNull();
    expect(after?.isHidden).toBe(true);
    expect(after?.hiddenById).toBeNull();
  });
});

describe('under review', () => {
  it('drops the store out of discovery but leaves the direct link working', async () => {
    await testDb.shop.update({
      where: { id: shopId },
      data: { isUnderReview: true, underReviewReason: 'Three counterfeit reports in a week.', underReviewSince: new Date() },
    });

    const discoverable = await testDb.shop.findFirst({ where: { id: shopId, ...DISCOVERABLE_SHOP } });
    const reachable = await testDb.shop.findFirst({ where: { id: shopId, ...VISIBLE_SHOP } });

    expect(discoverable).toBeNull();
    expect(reachable).not.toBeNull();
  });

  it('refuses to place a store under review without saying why', async () => {
    await expect(
      testDb.shop.update({ where: { id: shopId }, data: { isUnderReview: true, underReviewSince: new Date() } })
    ).rejects.toThrow();
  });

  it('refuses a whitespace-only reason', async () => {
    await expect(
      testDb.shop.update({
        where: { id: shopId },
        data: { isUnderReview: true, underReviewSince: new Date(), underReviewReason: '   ' },
      })
    ).rejects.toThrow();
  });
});

describe('complaints', () => {
  async function makeReport(over: Record<string, unknown> = {}) {
    return testDb.report.create({
      data: {
        shopId,
        userId: buyerIds[0],
        category: ReportCategory.COUNTERFEIT,
        reason: 'These are fake.',
        ...over,
      },
    });
  }

  it('defaults to OTHER so an older caller cannot fail validation', async () => {
    const r = await testDb.report.create({
      data: { shopId, userId: buyerIds[0], reason: 'Something is wrong.' },
    });
    expect(r.category).toBe(ReportCategory.OTHER);
  });

  it('refuses to mark a complaint resolved without a disposal timestamp', async () => {
    const r = await makeReport();
    await expect(
      testDb.report.update({ where: { id: r.id }, data: { status: ReportStatus.RESOLVED } })
    ).rejects.toThrow();
  });

  it('refuses to mark a complaint rejected without a disposal timestamp', async () => {
    // The CHECK is written as NOT IN ('OPEN','UNDER_REVIEW') precisely so that
    // the enum value added by the same migration is covered.
    const r = await makeReport();
    await expect(
      testDb.report.update({ where: { id: r.id }, data: { status: ReportStatus.REJECTED } })
    ).rejects.toThrow();
  });

  it('refuses a disposal that was never acknowledged', async () => {
    const r = await makeReport();
    await expect(
      testDb.report.update({
        where: { id: r.id },
        data: { status: ReportStatus.RESOLVED, resolvedAt: new Date() },
      })
    ).rejects.toThrow();
  });

  it('accepts a complaint acknowledged and then disposed of', async () => {
    const r = await makeReport();
    const now = new Date();
    const done = await testDb.report.update({
      where: { id: r.id },
      data: {
        acknowledgedAt: now,
        acknowledgedById: adminId,
        status: ReportStatus.RESOLVED,
        resolvedAt: now,
        resolutionNote: 'Listings removed and the seller warned.',
      },
    });
    expect(done.resolvedAt).not.toBeNull();
    expect(done.acknowledgedAt).not.toBeNull();
  });

  it('finds the overdue ones with an indexed query rather than by reading them', async () => {
    const old = new Date(Date.now() - 72 * 3_600_000);
    await makeReport({ createdAt: old });
    await makeReport({ userId: buyerIds[1] });

    const overdue = await testDb.report.count({
      where: {
        shopId,
        acknowledgedAt: null,
        createdAt: { lt: new Date(Date.now() - 48 * 3_600_000) },
      },
    });
    expect(overdue).toBe(1);
  });
});

describe('notices', () => {
  it('exists even when no email was ever sent', async () => {
    const n = await testDb.notice.create({
      data: {
        shopId,
        actorId: adminId,
        kind: NoticeKind.WARNING,
        subject: 'Please remove the branded listings',
        body: 'Two of your listings use a trademark you have not shown a licence for.',
      },
    });
    expect(n.emailedAt).toBeNull();
    expect(n.readAt).toBeNull();
    expect(n.sentAt).toBeInstanceOf(Date);
  });

  it('refuses an empty subject or body', async () => {
    await expect(
      testDb.notice.create({
        data: { shopId, actorId: adminId, kind: NoticeKind.WARNING, subject: '   ', body: 'Something' },
      })
    ).rejects.toThrow();
  });

  it('refuses a respond-by date on a notice that asks for nothing', async () => {
    await expect(
      testDb.notice.create({
        data: {
          shopId, actorId: adminId, kind: NoticeKind.WARNING,
          subject: 'A subject', body: 'A body long enough to be real.',
          requiresResponse: false, respondBy: new Date(),
        },
      })
    ).rejects.toThrow();
  });

  it('refuses a response timestamp with no response text', async () => {
    const n = await testDb.notice.create({
      data: {
        shopId, actorId: adminId, kind: NoticeKind.INFORMATION_REQUEST,
        subject: 'Please confirm your GSTIN', body: 'We need your GSTIN to keep your listings up.',
        requiresResponse: true,
      },
    });
    await expect(
      testDb.notice.update({ where: { id: n.id }, data: { respondedAt: new Date() } })
    ).rejects.toThrow();
  });

  it('will not let the admin who sent it be deleted', async () => {
    await testDb.notice.create({
      data: {
        shopId, actorId: adminId, kind: NoticeKind.SUSPENSION,
        subject: 'Your storefront has been suspended',
        body: 'Selling counterfeit goods, three buyer reports upheld.',
      },
    });
    // Restrict: a notice whose author vanished is a notice nobody can answer for.
    await expect(testDb.user.delete({ where: { id: adminId } })).rejects.toThrow();
  });
});

describe('the audit rules and the database agree', () => {
  it.each([
    ADMIN_ACTIONS.HIDE_REVIEW,
    ADMIN_ACTIONS.MARK_UNDER_REVIEW,
    ADMIN_ACTIONS.REJECT_REPORT,
  ])('requires a reason for %s in both places', async (action) => {
    expect(actionRequiresReason(action)).toBe(true);
    await expect(
      testDb.adminAction.create({
        data: { actorId: adminId, action, targetType: 'Shop', targetId: shopId },
      })
    ).rejects.toThrow();
  });

  it.each([ADMIN_ACTIONS.UNHIDE_REVIEW, ADMIN_ACTIONS.CLEAR_UNDER_REVIEW, ADMIN_ACTIONS.ACKNOWLEDGE_REPORT])(
    'lets %s through without one, so undoing a mistake stays cheap',
    async (action) => {
      expect(actionRequiresReason(action)).toBe(false);
      const row = await testDb.adminAction.create({
        data: { actorId: adminId, action, targetType: 'Shop', targetId: shopId },
      });
      expect(row.id).toBeTruthy();
    }
  );
});
