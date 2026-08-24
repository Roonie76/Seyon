import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { testDb, closeDatabase } from './setup';
import { actionRequiresReason, ADMIN_ACTIONS } from '@/backend/lib/admin-audit';

/**
 * The audit log and the rules around it, against a real database.
 *
 * The application enforces these too, but a CHECK constraint is what survives
 * someone writing a migration script or fixing something by hand in psql —
 * which is precisely when an unexplained suspension gets recorded.
 */

let adminId = '';

beforeAll(async () => {
  await testDb.$connect();
});

beforeEach(async () => {
  await testDb.adminAction.deleteMany({ where: { actor: { email: { startsWith: 'audit-test-' } } } });
  await testDb.user.deleteMany({ where: { email: { startsWith: 'audit-test-' } } });
  const admin = await testDb.user.create({
    data: { email: 'audit-test-admin@example.com', name: 'Audit Admin', role: 'ADMIN' },
  });
  adminId = admin.id;
});

afterAll(async () => {
  await testDb.adminAction.deleteMany({ where: { actor: { email: { startsWith: 'audit-test-' } } } });
  await testDb.user.deleteMany({ where: { email: { startsWith: 'audit-test-' } } });
  await closeDatabase();
});

describe('audit constraints', () => {
  it('records an ordinary action without a reason', async () => {
    const row = await testDb.adminAction.create({
      data: { actorId: adminId, action: ADMIN_ACTIONS.VERIFY_SHOP, targetType: 'Shop', targetId: 'shop_1' },
    });
    expect(row.id).toBeTruthy();
    expect(row.reason).toBeNull();
  });

  it('refuses a suspension with no reason', async () => {
    await expect(
      testDb.adminAction.create({
        data: { actorId: adminId, action: ADMIN_ACTIONS.SUSPEND_SHOP, targetType: 'Shop', targetId: 'shop_1' },
      })
    ).rejects.toThrow();
  });

  it('refuses a suspension whose reason is only whitespace', async () => {
    await expect(
      testDb.adminAction.create({
        data: {
          actorId: adminId, action: ADMIN_ACTIONS.SUSPEND_SHOP,
          targetType: 'Shop', targetId: 'shop_1', reason: '   ',
        },
      })
    ).rejects.toThrow();
  });

  it.each([
    ADMIN_ACTIONS.SUSPEND_SHOP,
    ADMIN_ACTIONS.DELETE_PRODUCT,
    ADMIN_ACTIONS.DELETE_SHOP,
    ADMIN_ACTIONS.GRANT_ADMIN,
    ADMIN_ACTIONS.REVOKE_ADMIN,
  ])('requires a reason for %s, in the database as well as the code', async (action) => {
    expect(actionRequiresReason(action)).toBe(true);
    await expect(
      testDb.adminAction.create({
        data: { actorId: adminId, action, targetType: 'Shop', targetId: 'x' },
      })
    ).rejects.toThrow();
  });

  it('accepts a destructive action that explains itself', async () => {
    const row = await testDb.adminAction.create({
      data: {
        actorId: adminId, action: ADMIN_ACTIONS.SUSPEND_SHOP, targetType: 'Shop',
        targetId: 'shop_1', reason: 'Listing counterfeit goods, reported three times.',
      },
    });
    expect(row.reason).toContain('counterfeit');
  });

  it('refuses a blank action name', async () => {
    await expect(
      testDb.adminAction.create({
        data: { actorId: adminId, action: '   ', targetType: 'Shop', targetId: 'shop_1' },
      })
    ).rejects.toThrow();
  });

  it('will not let an admin be deleted once they have acted', async () => {
    await testDb.adminAction.create({
      data: { actorId: adminId, action: ADMIN_ACTIONS.VERIFY_SHOP, targetType: 'Shop', targetId: 'shop_1' },
    });

    // Restrict, not Cascade: deleting the actor would erase the evidence of
    // what they did, which is the one thing this table exists to prevent.
    await expect(testDb.user.delete({ where: { id: adminId } })).rejects.toThrow();
  });

  it('keeps metadata for reconstructing what changed', async () => {
    const row = await testDb.adminAction.create({
      data: {
        actorId: adminId, action: ADMIN_ACTIONS.CHANGE_ROLE, targetType: 'User', targetId: 'user_9',
        metadata: { from: 'USER', to: 'SELLER' },
      },
    });
    expect(row.metadata).toEqual({ from: 'USER', to: 'SELLER' });
  });

  it('orders a target history newest first', async () => {
    for (const n of ['VERIFY_SHOP', 'UNVERIFY_SHOP', 'VERIFY_SHOP']) {
      await testDb.adminAction.create({
        data: { actorId: adminId, action: n, targetType: 'Shop', targetId: 'shop_hist' },
      });
      await new Promise((r) => setTimeout(r, 5));
    }
    const rows = await testDb.adminAction.findMany({
      where: { targetType: 'Shop', targetId: 'shop_hist' },
      orderBy: { createdAt: 'desc' },
    });
    expect(rows).toHaveLength(3);
    expect(rows[0].createdAt.getTime()).toBeGreaterThanOrEqual(rows[2].createdAt.getTime());
  });
});
