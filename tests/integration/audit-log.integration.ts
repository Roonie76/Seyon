import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { testDb, closeDatabase } from './setup';
import { listAdminActions, ADMIN_ACTIONS } from '@/backend/lib/admin-audit';

/**
 * The global audit log, against a real database.
 *
 * The assertion worth having here is the pagination one. `createdAt` is not
 * unique — a single action writes several rows in the same millisecond whenever
 * it touches more than one target — and offset paging silently drops rows when
 * the ordering ties. That failure is invisible: the page looks fine, it is just
 * missing evidence. So the rows are deliberately created with an identical
 * timestamp and the test asserts that paging through returns every one exactly
 * once.
 */

let adminA = '';
let adminB = '';

const PREFIX = 'audit-log-test-';

beforeAll(async () => {
  await testDb.$connect();
});

beforeEach(async () => {
  await testDb.adminAction.deleteMany({ where: { actor: { email: { startsWith: PREFIX } } } });
  await testDb.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  const a = await testDb.user.create({
    data: { email: `${PREFIX}a@example.com`, name: 'Admin A', role: 'ADMIN' },
  });
  const b = await testDb.user.create({
    data: { email: `${PREFIX}b@example.com`, name: 'Admin B', role: 'ADMIN' },
  });
  adminA = a.id;
  adminB = b.id;
});

afterAll(async () => {
  await testDb.adminAction.deleteMany({ where: { actor: { email: { startsWith: PREFIX } } } });
  await testDb.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await closeDatabase();
});

/** Rows for this test's actors only, so a shared database cannot pollute it. */
async function pageThrough(filterActor: string, take: number) {
  const seen: string[] = [];
  let cursor: string | undefined;
  for (let guard = 0; guard < 50; guard++) {
    const page = await listAdminActions({ actorId: filterActor, take, cursor });
    seen.push(...page.rows.map((r) => r.id));
    if (!page.nextCursor) return seen;
    cursor = page.nextCursor;
  }
  throw new Error('pagination did not terminate');
}

describe('listAdminActions', () => {
  it('returns newest first', async () => {
    for (const n of ['VERIFY_SHOP', 'SUSPEND_SHOP', 'UNSUSPEND_SHOP']) {
      await testDb.adminAction.create({
        data: {
          actorId: adminA, action: n, targetType: 'Shop', targetId: 'shop_1',
          reason: n === 'SUSPEND_SHOP' ? 'Counterfeit goods reported three times.' : null,
        },
      });
      await new Promise((r) => setTimeout(r, 5));
    }
    const page = await listAdminActions({ actorId: adminA });
    expect(page.rows).toHaveLength(3);
    expect(page.rows[0].action).toBe('UNSUSPEND_SHOP');
    expect(page.rows[2].action).toBe('VERIFY_SHOP');
  });

  it('pages through rows sharing one timestamp without dropping any', async () => {
    // The exact case offset paging gets wrong.
    const stamp = new Date('2026-08-01T10:00:00.000Z');
    for (let i = 0; i < 10; i++) {
      await testDb.adminAction.create({
        data: {
          actorId: adminA, action: ADMIN_ACTIONS.VERIFY_SHOP,
          targetType: 'Shop', targetId: `shop_${i}`, createdAt: stamp,
        },
      });
    }

    const seen = await pageThrough(adminA, 3);
    expect(seen).toHaveLength(10);
    expect(new Set(seen).size).toBe(10); // no duplicates either
  });

  it('never returns the cursor row twice', async () => {
    const stamp = new Date('2026-08-01T10:00:00.000Z');
    for (let i = 0; i < 4; i++) {
      await testDb.adminAction.create({
        data: {
          actorId: adminA, action: ADMIN_ACTIONS.VERIFY_SHOP,
          targetType: 'Shop', targetId: `shop_${i}`, createdAt: stamp,
        },
      });
    }
    const first = await listAdminActions({ actorId: adminA, take: 2 });
    expect(first.nextCursor).toBeTruthy();
    const second = await listAdminActions({ actorId: adminA, take: 2, cursor: first.nextCursor! });
    const overlap = first.rows.filter((r) => second.rows.some((s) => s.id === r.id));
    expect(overlap).toHaveLength(0);
  });

  it('reports no next page when the last page is exactly full', async () => {
    // The off-by-one: taking take+1 is what makes this correct.
    for (let i = 0; i < 4; i++) {
      await testDb.adminAction.create({
        data: { actorId: adminA, action: 'VERIFY_SHOP', targetType: 'Shop', targetId: `s${i}` },
      });
    }
    const page = await listAdminActions({ actorId: adminA, take: 4 });
    expect(page.rows).toHaveLength(4);
    expect(page.nextCursor).toBeNull();
  });

  it('filters by actor, action and target type', async () => {
    await testDb.adminAction.create({
      data: { actorId: adminA, action: 'VERIFY_SHOP', targetType: 'Shop', targetId: 's1' },
    });
    await testDb.adminAction.create({
      data: { actorId: adminB, action: 'APPROVE_KYC', targetType: 'SellerKyc', targetId: 'k1' },
    });

    expect((await listAdminActions({ actorId: adminB })).rows).toHaveLength(1);
    expect((await listAdminActions({ actorId: adminA, action: 'APPROVE_KYC' })).rows).toHaveLength(0);
    expect((await listAdminActions({ actorId: adminB, targetType: 'SellerKyc' })).rows).toHaveLength(1);
    expect((await listAdminActions({ actorId: adminB, targetType: 'Shop' })).rows).toHaveLength(0);
  });

  it('filters by date range inclusively at both ends', async () => {
    const day = (d: string) => new Date(`${d}T12:00:00.000Z`);
    for (const d of ['2026-07-01', '2026-07-15', '2026-08-01']) {
      await testDb.adminAction.create({
        data: {
          actorId: adminA, action: 'VERIFY_SHOP', targetType: 'Shop',
          targetId: d, createdAt: day(d),
        },
      });
    }

    const july = await listAdminActions({
      actorId: adminA,
      from: new Date('2026-07-01T00:00:00.000Z'),
      to: new Date('2026-07-31T23:59:59.999Z'),
    });
    expect(july.rows.map((r) => r.targetId).sort()).toEqual(['2026-07-01', '2026-07-15']);

    // A single-day range must include that day's rows, not exclude them.
    const oneDay = await listAdminActions({
      actorId: adminA,
      from: new Date('2026-07-15T00:00:00.000Z'),
      to: new Date('2026-07-15T23:59:59.999Z'),
    });
    expect(oneDay.rows).toHaveLength(1);
  });

  it('caps take so a caller cannot ask for the whole table', async () => {
    for (let i = 0; i < 3; i++) {
      await testDb.adminAction.create({
        data: { actorId: adminA, action: 'VERIFY_SHOP', targetType: 'Shop', targetId: `s${i}` },
      });
    }
    // 10_000 is clamped to the 100 maximum; with 3 rows the observable effect is
    // simply that it does not throw and returns them all.
    const page = await listAdminActions({ actorId: adminA, take: 10_000 });
    expect(page.rows).toHaveLength(3);
  });

  it('lists the actors present in the log, for the filter control', async () => {
    await testDb.adminAction.create({
      data: { actorId: adminA, action: 'VERIFY_SHOP', targetType: 'Shop', targetId: 's1' },
    });
    await testDb.adminAction.create({
      data: { actorId: adminA, action: 'UNVERIFY_SHOP', targetType: 'Shop', targetId: 's1' },
    });
    const page = await listAdminActions({ actorId: adminA });
    // Distinct: two rows by one actor is one entry.
    expect(page.actors.filter((a) => a.id === adminA)).toHaveLength(1);
  });
});
