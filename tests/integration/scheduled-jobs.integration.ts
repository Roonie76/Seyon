import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { testDb, closeDatabase } from './setup';
import {
  sweepAbandonedKycDocuments,
  chaseOverdueNotices,
  sendSlaDigest,
  claimOncePerDay,
  KYC_DOCUMENT_MAX_AGE_DAYS,
  NOTICE_CHASE_GRACE_DAYS,
} from '@/backend/lib/scheduled-jobs';
import { systemActorId, SYSTEM_ACTOR_EMAIL, _resetSystemActorCache } from '@/backend/lib/system-actor';

/**
 * The nightly work, against a real database.
 *
 * The property that matters is that every job is safe to run twice. Vercel can
 * invoke a cron more than once for a single schedule, and a sweep written as
 * though it runs exactly once will delete something it should not the second
 * time. Each test here runs the job, asserts what it did, then runs it again
 * and asserts it did nothing.
 */

vi.mock('@/backend/lib/kyc-storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/backend/lib/kyc-storage')>();
  return {
    ...actual,
    // Storage is out of scope here; what is being tested is which rows are
    // selected and what happens to them afterwards.
    deleteKycDocument: vi.fn().mockResolvedValue(true),
  };
});

vi.mock('@/backend/lib/notify', () => ({ notify: vi.fn().mockResolvedValue({ sent: false }) }));

const PREFIX = 'sched-test-';
const DAY = 86_400_000;

let shopId = '';
let adminId = '';

beforeAll(async () => {
  await testDb.$connect();
});

async function cleanup() {
  _resetSystemActorCache();
  // The once-a-day claims. Without this every test after the first would find
  // the day already taken and see a job that correctly did nothing.
  await testDb.rateLimitCounter.deleteMany({ where: { key: { startsWith: 'cron:' } } });
  await testDb.adminAction.deleteMany({
    where: { actor: { email: { in: [SYSTEM_ACTOR_EMAIL] } } },
  });
  await testDb.adminAction.deleteMany({ where: { actor: { email: { startsWith: PREFIX } } } });
  await testDb.shop.deleteMany({ where: { owner: { email: { startsWith: PREFIX } } } });
  await testDb.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
}

beforeEach(async () => {
  await cleanup();
  vi.clearAllMocks();

  const admin = await testDb.user.create({
    data: { email: `${PREFIX}admin@example.com`, name: 'Sched Admin', role: 'ADMIN' },
  });
  adminId = admin.id;

  const owner = await testDb.user.create({
    data: { email: `${PREFIX}owner@example.com`, name: 'Sched Owner', role: 'SELLER' },
  });
  const shop = await testDb.shop.create({
    data: { ownerId: owner.id, name: 'Sched Store', slug: `${PREFIX}store`, whatsapp: '919000001111' },
  });
  shopId = shop.id;
});

afterAll(async () => {
  await cleanup();
  await testDb.user.deleteMany({ where: { email: SYSTEM_ACTOR_EMAIL } });
  await closeDatabase();
});

async function makeKyc(opts: { ageDays: number; status?: 'PENDING_REVIEW' | 'APPROVED'; email: string }) {
  const user = await testDb.user.create({
    data: { email: `${PREFIX}${opts.email}`, name: 'Sched Seller', role: 'SELLER' },
  });
  return testDb.sellerKyc.create({
    data: {
      userId: user.id,
      tier: 'TIER_1',
      status: opts.status ?? 'PENDING_REVIEW',
      documentPath: `kyc/${user.id}/doc.pdf`,
      submittedAt: new Date(Date.now() - opts.ageDays * DAY),
    },
  });
}

describe('the KYC retention sweep', () => {
  it('deletes a document nobody decided on, and records that it did', async () => {
    const kyc = await makeKyc({ ageDays: KYC_DOCUMENT_MAX_AGE_DAYS + 1, email: 'stale@example.com' });

    const result = await sweepAbandonedKycDocuments();
    expect(result.did).toBe(1);

    const after = await testDb.sellerKyc.findUniqueOrThrow({ where: { id: kyc.id } });
    expect(after.documentPath).toBeNull();
    expect(after.documentDeletedAt).not.toBeNull();

    // Recorded under the system account, so "who did this" has an answer.
    const row = await testDb.adminAction.findFirst({
      where: { action: 'SWEEP_KYC_DOCUMENTS' },
      include: { actor: { select: { email: true, role: true } } },
    });
    expect(row).not.toBeNull();
    expect(row!.actor.email).toBe(SYSTEM_ACTOR_EMAIL);
    // A job account that could act as an admin would be a standing back door.
    expect(row!.actor.role).toBe('USER');
  });

  it('is a no-op the second time', async () => {
    await makeKyc({ ageDays: KYC_DOCUMENT_MAX_AGE_DAYS + 1, email: 'twice@example.com' });

    expect((await sweepAbandonedKycDocuments()).did).toBe(1);
    // The exact case a cron invoked twice produces.
    expect((await sweepAbandonedKycDocuments()).did).toBe(0);

    // And no second audit row: a job that records "swept 0" every night buries
    // the night it swept forty.
    expect(await testDb.adminAction.count({ where: { action: 'SWEEP_KYC_DOCUMENTS' } })).toBe(1);
  });

  it('leaves a document that is not old enough', async () => {
    const kyc = await makeKyc({ ageDays: KYC_DOCUMENT_MAX_AGE_DAYS - 1, email: 'young@example.com' });

    expect((await sweepAbandonedKycDocuments()).did).toBe(0);
    const after = await testDb.sellerKyc.findUniqueOrThrow({ where: { id: kyc.id } });
    expect(after.documentPath).not.toBeNull();
  });

  it('leaves a document attached to a decided application alone', async () => {
    // Approved records are handled by the decision path. Sweeping them here
    // would be a second, unrecorded deletion of something already dealt with.
    const kyc = await makeKyc({
      ageDays: KYC_DOCUMENT_MAX_AGE_DAYS + 10,
      status: 'APPROVED',
      email: 'approved@example.com',
    });

    expect((await sweepAbandonedKycDocuments()).did).toBe(0);
    const after = await testDb.sellerKyc.findUniqueOrThrow({ where: { id: kyc.id } });
    expect(after.documentPath).not.toBeNull();
  });

  it('writes nothing at all when there is nothing to sweep', async () => {
    expect((await sweepAbandonedKycDocuments()).did).toBe(0);
    expect(await testDb.adminAction.count({ where: { action: 'SWEEP_KYC_DOCUMENTS' } })).toBe(0);
  });
});

describe('the overdue notice chase', () => {
  async function makeNotice(opts: { respondByDaysAgo: number | null; responded?: boolean }) {
    return testDb.notice.create({
      data: {
        shopId,
        actorId: adminId,
        kind: 'INFORMATION_REQUEST',
        subject: 'We need the invoice for order 41',
        body: 'A buyer says the item never arrived. Send us the dispatch proof.',
        requiresResponse: opts.respondByDaysAgo !== null,
        respondBy:
          opts.respondByDaysAgo === null ? null : new Date(Date.now() - opts.respondByDaysAgo * DAY),
        respondedAt: opts.responded ? new Date() : null,
        response: opts.responded ? 'Here it is.' : null,
      },
    });
  }

  it('chases one that is past its date and unanswered', async () => {
    await makeNotice({ respondByDaysAgo: NOTICE_CHASE_GRACE_DAYS + 1 });
    expect((await chaseOverdueNotices()).did).toBe(1);
  });

  it('leaves one still inside the grace window', async () => {
    // Chasing the morning after the deadline reads as nagging; the grace window
    // is what makes the reminder land as a reminder.
    await makeNotice({ respondByDaysAgo: NOTICE_CHASE_GRACE_DAYS - 1 });
    expect((await chaseOverdueNotices()).did).toBe(0);
  });

  it('leaves one that has been answered', async () => {
    await makeNotice({ respondByDaysAgo: 30, responded: true });
    expect((await chaseOverdueNotices()).did).toBe(0);
  });

  it('leaves one that never asked for a response', async () => {
    await makeNotice({ respondByDaysAgo: null });
    expect((await chaseOverdueNotices()).did).toBe(0);
  });

  it('does not change the notice, so nothing is lost by running twice', async () => {
    const notice = await makeNotice({ respondByDaysAgo: NOTICE_CHASE_GRACE_DAYS + 1 });
    await chaseOverdueNotices();
    await chaseOverdueNotices();

    const after = await testDb.notice.findUniqueOrThrow({ where: { id: notice.id } });
    expect(after.respondedAt).toBeNull();
    expect(after.subject).toBe('We need the invoice for order 41');
  });
});

describe('the system actor', () => {
  it('creates itself once and reuses it', async () => {
    _resetSystemActorCache();
    const first = await systemActorId();
    _resetSystemActorCache();
    const second = await systemActorId();

    expect(first).toBe(second);
    expect(await testDb.user.count({ where: { email: SYSTEM_ACTOR_EMAIL } })).toBe(1);
  });

  it('is not an admin', async () => {
    _resetSystemActorCache();
    const id = await systemActorId();
    const user = await testDb.user.findUniqueOrThrow({ where: { id } });
    // requireAdmin would refuse it, so nothing can act as an admin through it
    // even if a sign-in were somehow possible.
    expect(user.role).toBe('USER');
  });
});

describe('the once-a-day claim', () => {
  /**
   * `vercel.json` ships in the repository and both Vercel projects deploy it,
   * so the nightly schedule is registered twice and the route is invoked
   * twice. The sweeps do not care. The two jobs that send email do: without
   * this, every admin gets the digest twice and every unanswered notice is
   * chased twice.
   */

  it('is granted once and refused after that', async () => {
    expect(await claimOncePerDay('demo')).toBe(true);
    expect(await claimOncePerDay('demo')).toBe(false);
    expect(await claimOncePerDay('demo')).toBe(false);
  });

  it('is per job, so one job does not consume another job\'s day', async () => {
    expect(await claimOncePerDay('demo-a')).toBe(true);
    expect(await claimOncePerDay('demo-b')).toBe(true);
  });

  it('is per day, so tomorrow is a fresh claim', async () => {
    const today = new Date('2026-08-25T19:30:00Z');
    const tomorrow = new Date('2026-08-26T19:30:00Z');

    expect(await claimOncePerDay('demo', today)).toBe(true);
    expect(await claimOncePerDay('demo', today)).toBe(false);
    expect(await claimOncePerDay('demo', tomorrow)).toBe(true);
  });

  it('holds across the UTC day, not the local one', async () => {
    // The cron runs at 19:30 UTC, which is the small hours in IST. Two
    // invocations either side of local midnight are the same UTC day and must
    // not both send.
    const before = new Date('2026-08-25T18:00:00Z');
    const after = new Date('2026-08-25T23:59:00Z');

    expect(await claimOncePerDay('demo', before)).toBe(true);
    expect(await claimOncePerDay('demo', after)).toBe(false);
  });

  it('only the winner emails when two invocations chase the same notice', async () => {
    const { notify } = await import('@/backend/lib/notify');

    await testDb.notice.create({
      data: {
        shopId,
        actorId: adminId,
        kind: 'INFORMATION_REQUEST',
        subject: 'Second request for the dispatch proof',
        body: 'We asked a week ago and have not heard back.',
        requiresResponse: true,
        respondBy: new Date(Date.now() - (NOTICE_CHASE_GRACE_DAYS + 1) * DAY),
      },
    });

    expect((await chaseOverdueNotices()).did).toBe(1);
    const afterFirst = vi.mocked(notify).mock.calls.length;
    expect(afterFirst).toBeGreaterThan(0);

    const second = await chaseOverdueNotices();
    expect(second.did).toBe(0);
    expect(second.detail).toBe('already chased today');
    // The point of the whole thing: no second email.
    expect(vi.mocked(notify).mock.calls.length).toBe(afterFirst);
  });

  it('sends the complaint digest once, however many times the cron fires', async () => {
    const { notify } = await import('@/backend/lib/notify');

    const reporter = await testDb.user.create({
      data: { email: `${PREFIX}reporter@example.com`, name: 'Sched Reporter' },
    });
    await testDb.report.create({
      data: {
        shopId,
        userId: reporter.id,
        category: 'COUNTERFEIT',
        reason: 'The listing photographs are lifted from another shop entirely.',
        // Old enough to be past the acknowledgement deadline.
        createdAt: new Date(Date.now() - 7 * DAY),
      },
    });

    const first = await sendSlaDigest();
    expect(first.did).toBeGreaterThan(0);
    const afterFirst = vi.mocked(notify).mock.calls.length;
    expect(afterFirst).toBeGreaterThan(0);

    const second = await sendSlaDigest();
    expect(second.did).toBe(0);
    expect(second.detail).toBe('digest already sent today');
    expect(vi.mocked(notify).mock.calls.length).toBe(afterFirst);
  });

  it('does not spend the day on a night with nothing to report', async () => {
    // No complaints exist, so the digest sends nothing and takes no claim --
    // otherwise a quiet 19:30 would silence a busy 23:00 retry.
    expect((await sendSlaDigest()).did).toBe(0);

    const claims = await testDb.rateLimitCounter.count({
      where: { key: { startsWith: 'cron:sla-digest:' } },
    });
    expect(claims).toBe(0);
  });

  it('points the admin at the host the admin screens are actually on', async () => {
    // Configured here rather than read from the ambient environment, because
    // with SELLER_HOSTS unset ADMIN_URL and SITE_URL are the same string and
    // the assertion would pass against the very bug it exists to catch.
    vi.stubEnv('SELLER_HOSTS', 'admin.example.test');
    vi.resetModules();

    const { sendSlaDigest: freshDigest } = await import('@/backend/lib/scheduled-jobs');
    const { notify: freshNotify } = await import('@/backend/lib/notify');

    const reporter = await testDb.user.create({
      data: { email: `${PREFIX}reporter2@example.com`, name: 'Sched Reporter Two' },
    });
    await testDb.report.create({
      data: {
        shopId,
        userId: reporter.id,
        category: 'PROHIBITED_ITEM',
        reason: 'This store is listing prescription medicines under home remedies.',
        createdAt: new Date(Date.now() - 7 * DAY),
      },
    });

    await freshDigest();

    const body = vi
      .mocked(freshNotify)
      .mock.calls.map((c) => c[0].text)
      .join('\n');

    // The seller host, where /admin is served.
    expect(body).toContain('https://admin.example.test/admin/reports');
    // Not the shopper host, where /admin redirects to the marketplace.
    expect(body).not.toContain('http://localhost:3000/admin/reports');

    vi.unstubAllEnvs();
    vi.resetModules();
  });
});
