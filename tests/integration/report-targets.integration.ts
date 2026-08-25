import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { testDb, closeDatabase } from './setup';

/**
 * One Report model, two things it can be about.
 *
 * The application decides the target; the database refuses the states the
 * application must never produce. That duplication is the point — a row
 * claiming to be about a review with no review attached is unreadable by the
 * queue, and a row claiming to be about the shop while carrying a review id is
 * worse: it renders as a store complaint and silently loses the thing it was
 * actually about. Neither is reachable through the action today, and both
 * become reachable the moment someone writes a migration or fixes something by
 * hand in psql.
 */

const PREFIX = 'report-target-test-';

let shopId = '';
let ownerId = '';
let buyerId = '';
let otherBuyerId = '';
let reviewId = '';

beforeAll(async () => {
  await testDb.$connect();
});

async function cleanup() {
  await testDb.shop.deleteMany({ where: { owner: { email: { startsWith: PREFIX } } } });
  await testDb.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
}

beforeEach(async () => {
  await cleanup();

  const owner = await testDb.user.create({
    data: { email: `${PREFIX}owner@example.com`, name: 'Target Owner', role: 'SELLER' },
  });
  ownerId = owner.id;

  const shop = await testDb.shop.create({
    data: {
      ownerId: owner.id, name: 'Target Store', slug: `${PREFIX}store`,
      whatsapp: '919000000456', isListed: true,
    },
  });
  shopId = shop.id;

  const buyer = await testDb.user.create({
    data: { email: `${PREFIX}buyer@example.com`, name: 'Target Buyer', role: 'USER' },
  });
  buyerId = buyer.id;

  const other = await testDb.user.create({
    data: { email: `${PREFIX}other@example.com`, name: 'Other Buyer', role: 'USER' },
  });
  otherBuyerId = other.id;

  const review = await testDb.review.create({
    data: { shopId: shop.id, userId: buyer.id, rating: 1, comment: 'Absolute rubbish, avoid.' },
  });
  reviewId = review.id;
});

afterAll(async () => {
  await cleanup();
  await closeDatabase();
});

describe('report targets', () => {
  it('accepts a complaint about the store, with no review attached', async () => {
    const row = await testDb.report.create({
      data: { shopId, userId: buyerId, reason: 'Sells counterfeit goods.' },
    });
    // The default keeps every existing caller — including the buyer-facing
    // store form, which sends no target — filing valid rows.
    expect(row.targetType).toBe('SHOP');
    expect(row.reviewId).toBeNull();
  });

  it('accepts a complaint about a review', async () => {
    const row = await testDb.report.create({
      data: {
        shopId, userId: otherBuyerId, reason: 'Abusive language about the seller.',
        targetType: 'REVIEW', reviewId,
      },
    });
    expect(row.targetType).toBe('REVIEW');
    expect(row.reviewId).toBe(reviewId);
  });

  it('refuses a REVIEW complaint with no review attached', async () => {
    await expect(
      testDb.report.create({
        data: { shopId, userId: otherBuyerId, reason: 'Something about a review.', targetType: 'REVIEW' },
      })
    ).rejects.toThrow();
  });

  it('refuses a SHOP complaint that carries a review id', async () => {
    // The nastier of the two: it renders as a store complaint and loses its
    // actual subject rather than failing visibly.
    await expect(
      testDb.report.create({
        data: {
          shopId, userId: otherBuyerId, reason: 'Confused complaint.',
          targetType: 'SHOP', reviewId,
        },
      })
    ).rejects.toThrow();
  });

  it('refuses the same person reporting one review twice', async () => {
    await testDb.report.create({
      data: {
        shopId, userId: otherBuyerId, reason: 'Abusive language.',
        targetType: 'REVIEW', reviewId,
      },
    });
    await expect(
      testDb.report.create({
        data: {
          shopId, userId: otherBuyerId, reason: 'Saying it again.',
          targetType: 'REVIEW', reviewId,
        },
      })
    ).rejects.toThrow();
  });

  it('lets two different people report the same review', async () => {
    // The partial unique index is per person. Ten people reporting one review
    // is the signal worth having, not a constraint violation.
    await testDb.report.create({
      data: { shopId, userId: otherBuyerId, reason: 'Abusive language.', targetType: 'REVIEW', reviewId },
    });
    await testDb.report.create({
      data: { shopId, userId: ownerId, reason: 'This is not a real customer.', targetType: 'REVIEW', reviewId },
    });
    expect(await testDb.report.count({ where: { reviewId } })).toBe(2);
  });

  it('still lets one person report the same store more than once', async () => {
    // Deliberately repeatable: a buyer may report a store again for something
    // new. The unique index is partial so it never touches these rows.
    await testDb.report.create({ data: { shopId, userId: buyerId, reason: 'Counterfeit goods.' } });
    await testDb.report.create({ data: { shopId, userId: buyerId, reason: 'Now they are ignoring me.' } });
    expect(await testDb.report.count({ where: { shopId, targetType: 'SHOP' } })).toBe(2);
  });

  it('takes review complaints away with the review, and leaves store complaints alone', async () => {
    await testDb.report.create({
      data: { shopId, userId: otherBuyerId, reason: 'Abusive language.', targetType: 'REVIEW', reviewId },
    });
    await testDb.report.create({ data: { shopId, userId: buyerId, reason: 'Counterfeit goods.' } });

    await testDb.review.delete({ where: { id: reviewId } });

    expect(await testDb.report.count({ where: { reviewId } })).toBe(0);
    expect(await testDb.report.count({ where: { shopId, targetType: 'SHOP' } })).toBe(1);
  });

  it('keeps a review complaint attached to its shop, so store counts include it', async () => {
    // shopId is set on review complaints too. A complaint about a review is
    // still a signal about that store, and the queue's "open against this
    // store" count would understate it otherwise.
    await testDb.report.create({
      data: { shopId, userId: otherBuyerId, reason: 'Abusive language.', targetType: 'REVIEW', reviewId },
    });
    const openAgainstStore = await testDb.report.count({
      where: { shopId, status: { in: ['OPEN', 'UNDER_REVIEW'] } },
    });
    expect(openAgainstStore).toBe(1);
  });

  it('hiding the reviewed content does not remove the complaint about it', async () => {
    const report = await testDb.report.create({
      data: { shopId, userId: otherBuyerId, reason: 'Abusive language.', targetType: 'REVIEW', reviewId },
    });
    // A hidden review must carry a reason and a timestamp — Review_hidden_has_reason,
    // from the moderation migration. Setting isHidden alone is refused, which is
    // how this test found out it was written wrong.
    await testDb.review.update({
      where: { id: reviewId },
      data: { isHidden: true, hiddenAt: new Date(), hiddenReason: 'Abusive language about the seller.' },
    });

    // Hiding is the action; closing the complaint is a separate step, because
    // the person who reported it still has to be told what was decided.
    const after = await testDb.report.findUnique({ where: { id: report.id } });
    expect(after).not.toBeNull();
    expect(after!.resolvedAt).toBeNull();
  });
});
