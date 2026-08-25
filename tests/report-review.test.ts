import { describe, it, expect, vi, beforeEach } from 'vitest';
import { _clearRateLimitStore } from '../src/backend/lib/rate-limit';
import { createReport } from '../src/backend/actions/reports';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';

/**
 * The guards around reporting a review.
 *
 * These are the cases the database cannot express — they depend on who is
 * asking. The CHECK constraint stops a malformed row; none of it stops a person
 * reporting their own review, or reporting a review that belongs to a different
 * store than the one they claim.
 */

vi.mock('@/lib/db', () => ({
  db: {
    shop: { findUnique: vi.fn() },
    review: { findUnique: vi.fn() },
    report: { create: vi.fn(), findFirst: vi.fn() },
  },
}));

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock('@/shared/lib/cache', () => ({
  revalidateShopSurface: vi.fn(),
  revalidateMarketplace: vi.fn(),
}));

const SHOP_ID = 'clshop00000000000000000001';
const REVIEW_ID = 'clrev000000000000000000001';
const ME = 'cluser00000000000000000001';
const SOMEONE_ELSE = 'cluser00000000000000000002';

const mockDb = db as unknown as {
  shop: { findUnique: ReturnType<typeof vi.fn> };
  review: { findUnique: ReturnType<typeof vi.fn> };
  report: { create: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn> };
};

function signedInAs(userId: string) {
  (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: userId } });
}

beforeEach(() => {
  vi.clearAllMocks();
  _clearRateLimitStore();
  signedInAs(ME);
  mockDb.shop.findUnique.mockResolvedValue({ id: SHOP_ID, slug: 'a-store' });
  mockDb.report.findFirst.mockResolvedValue(null);
  mockDb.report.create.mockImplementation(async ({ data }: { data: unknown }) => ({
    id: 'clrep000000000000000000001',
    ...(data as object),
  }));
});

const GOOD = { category: 'OFFENSIVE_CONTENT' as const, reason: 'Abusive language about the seller.' };

describe('reporting a review', () => {
  it('files a review complaint against the right target', async () => {
    mockDb.review.findUnique.mockResolvedValue({
      id: REVIEW_ID, shopId: SHOP_ID, userId: SOMEONE_ELSE, isHidden: false,
    });

    const res = await createReport(SHOP_ID, { ...GOOD, reviewId: REVIEW_ID });
    expect('success' in res).toBe(true);

    const written = mockDb.report.create.mock.calls[0][0].data;
    expect(written.targetType).toBe('REVIEW');
    expect(written.reviewId).toBe(REVIEW_ID);
    // Still attached to the shop: a complaint about a review is also a signal
    // about the store, and the store's open count should include it.
    expect(written.shopId).toBe(SHOP_ID);
  });

  it('refuses a review that belongs to a different store', async () => {
    // Otherwise a complaint filed against store A could carry store B's review,
    // and the queue would show it under the wrong seller.
    mockDb.review.findUnique.mockResolvedValue({
      id: REVIEW_ID, shopId: 'clshop00000000000000000009', userId: SOMEONE_ELSE, isHidden: false,
    });

    const res = await createReport(SHOP_ID, { ...GOOD, reviewId: REVIEW_ID });
    expect(res).toEqual({ error: 'That review is not on this store.' });
    expect(mockDb.report.create).not.toHaveBeenCalled();
  });

  it('refuses reporting your own review', async () => {
    mockDb.review.findUnique.mockResolvedValue({
      id: REVIEW_ID, shopId: SHOP_ID, userId: ME, isHidden: false,
    });

    const res = await createReport(SHOP_ID, { ...GOOD, reviewId: REVIEW_ID });
    expect('error' in res && res.error).toContain('your own review');
    expect(mockDb.report.create).not.toHaveBeenCalled();
  });

  it('refuses a review that is already hidden', async () => {
    // Nothing left for a moderator to decide, and a queue full of complaints
    // about invisible reviews buries the ones that matter.
    mockDb.review.findUnique.mockResolvedValue({
      id: REVIEW_ID, shopId: SHOP_ID, userId: SOMEONE_ELSE, isHidden: true,
    });

    const res = await createReport(SHOP_ID, { ...GOOD, reviewId: REVIEW_ID });
    expect('error' in res && res.error).toContain('already hidden');
    expect(mockDb.report.create).not.toHaveBeenCalled();
  });

  it('refuses a second complaint about the same review from the same person', async () => {
    mockDb.review.findUnique.mockResolvedValue({
      id: REVIEW_ID, shopId: SHOP_ID, userId: SOMEONE_ELSE, isHidden: false,
    });
    mockDb.report.findFirst.mockResolvedValue({ id: 'clrep000000000000000000002' });

    const res = await createReport(SHOP_ID, { ...GOOD, reviewId: REVIEW_ID });
    expect('error' in res && res.error).toContain('already reported');
    expect(mockDb.report.create).not.toHaveBeenCalled();
  });

  it('refuses a review reference that does not exist', async () => {
    mockDb.review.findUnique.mockResolvedValue(null);

    const res = await createReport(SHOP_ID, { ...GOOD, reviewId: REVIEW_ID });
    expect(res).toEqual({ error: 'That review is not on this store.' });
  });

  it('still files a store complaint when no review is named', async () => {
    // The existing buyer-facing store form sends no target. It must keep
    // working exactly as before.
    const res = await createReport(SHOP_ID, GOOD);
    expect('success' in res).toBe(true);

    const written = mockDb.report.create.mock.calls[0][0].data;
    expect(written.targetType).toBe('SHOP');
    expect(written.reviewId).toBeUndefined();
    // No review lookup happens at all on this path.
    expect(mockDb.review.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a malformed review reference before touching the database', async () => {
    const res = await createReport(SHOP_ID, { ...GOOD, reviewId: 'not-a-cuid' });
    expect('error' in res).toBe(true);
    expect(mockDb.review.findUnique).not.toHaveBeenCalled();
    expect(mockDb.report.create).not.toHaveBeenCalled();
  });
});
