import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { testDb, closeDatabase } from './setup';
import { ADMIN_ACTIONS } from '@/backend/lib/admin-audit';

/**
 * What survives deleting a store.
 *
 * The action is covered end-to-end in the browser suite. What is worth pinning
 * down here is the data shape underneath it, because the whole design rests on
 * one asymmetry: everything attached to a shop cascades away with it, and the
 * audit row does not. If `AdminAction` ever gained a foreign key to `Shop`, the
 * record of why a store was removed would be deleted by the removal — and
 * nothing in the application code would look wrong.
 */

const PREFIX = 'shop-del-test-';

let adminId = '';
let ownerId = '';
let shopId = '';

beforeAll(async () => {
  await testDb.$connect();
});

async function cleanup() {
  await testDb.adminAction.deleteMany({ where: { actor: { email: { startsWith: PREFIX } } } });
  // Shops first. Notice.actor is onDelete: Restrict, so an admin who authored a
  // notice cannot be deleted while it exists — and deleting the shop is what
  // cascades the notice away. Getting this order wrong fails the teardown, not
  // the assertion, which is a confusing way to find out.
  await testDb.shop.deleteMany({ where: { owner: { email: { startsWith: PREFIX } } } });
  await testDb.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
}

beforeEach(async () => {
  await cleanup();

  const admin = await testDb.user.create({
    data: { email: `${PREFIX}admin@example.com`, name: 'Del Admin', role: 'ADMIN' },
  });
  adminId = admin.id;

  const owner = await testDb.user.create({
    data: { email: `${PREFIX}owner@example.com`, name: 'Del Owner', role: 'SELLER' },
  });
  ownerId = owner.id;

  const shop = await testDb.shop.create({
    data: {
      ownerId: owner.id,
      name: 'Doomed Store',
      slug: `${PREFIX}doomed`,
      whatsapp: '919000000123',
      isListed: true,
    },
  });
  shopId = shop.id;

  await testDb.product.create({
    data: { shopId: shop.id, title: 'A thing', slug: `${PREFIX}thing`, price: 100, category: 'other' },
  });
  const buyer = await testDb.user.create({
    data: { email: `${PREFIX}buyer@example.com`, name: 'Del Buyer', role: 'USER' },
  });
  await testDb.review.create({
    data: { shopId: shop.id, userId: buyer.id, rating: 1, comment: 'Never arrived.' },
  });
  await testDb.report.create({
    data: { shopId: shop.id, userId: buyer.id, category: 'NON_DELIVERY', reason: 'Paid, nothing came.' },
  });
  await testDb.notice.create({
    data: {
      shopId: shop.id, actorId: admin.id, kind: 'WARNING',
      subject: 'Explain the missing order', body: 'A buyer says they paid and received nothing.',
    },
  });
});

afterAll(async () => {
  await cleanup();
  await closeDatabase();
});

describe('deleting a shop', () => {
  it('cascades reviews, reports, products and notices away with it', async () => {
    await testDb.shop.delete({ where: { id: shopId } });

    expect(await testDb.product.count({ where: { shopId } })).toBe(0);
    expect(await testDb.review.count({ where: { shopId } })).toBe(0);
    expect(await testDb.report.count({ where: { shopId } })).toBe(0);
    expect(await testDb.notice.count({ where: { shopId } })).toBe(0);
  });

  it('leaves the audit row standing, with the store described in it', async () => {
    // Written first, in the same transaction, exactly as the action does it.
    await testDb.$transaction(async (tx) => {
      await tx.adminAction.create({
        data: {
          actorId: adminId,
          action: ADMIN_ACTIONS.DELETE_SHOP,
          targetType: 'Shop',
          targetId: shopId,
          reason: 'Repeated non-delivery; three complaints upheld.',
          metadata: { name: 'Doomed Store', slug: `${PREFIX}doomed`, ownerEmail: `${PREFIX}owner@example.com` },
        },
      });
      await tx.shop.delete({ where: { id: shopId } });
    });

    const row = await testDb.adminAction.findFirst({ where: { targetId: shopId } });
    expect(row).not.toBeNull();
    expect(row!.reason).toContain('non-delivery');
    // The store is gone, so the metadata is the only description of it left.
    expect((row!.metadata as { slug: string }).slug).toBe(`${PREFIX}doomed`);
    expect(await testDb.shop.findUnique({ where: { id: shopId } })).toBeNull();
  });

  it('refuses an unexplained deletion at the database level', async () => {
    // Not only in the action: a script writing this row directly is exactly
    // when an unexplained removal gets recorded.
    await expect(
      testDb.adminAction.create({
        data: {
          actorId: adminId, action: ADMIN_ACTIONS.DELETE_SHOP,
          targetType: 'Shop', targetId: shopId,
        },
      })
    ).rejects.toThrow();
  });

  it('still cannot delete the admin who did it', async () => {
    await testDb.adminAction.create({
      data: {
        actorId: adminId, action: ADMIN_ACTIONS.DELETE_SHOP, targetType: 'Shop',
        targetId: shopId, reason: 'Counterfeit goods, three complaints upheld.',
      },
    });
    await testDb.shop.delete({ where: { id: shopId } });

    // onDelete: Restrict — removing the actor would erase the evidence.
    await expect(testDb.user.delete({ where: { id: adminId } })).rejects.toThrow();
  });

  // The owner's role after removal is decided by roleAfterShopRemoval and unit
  // tested there. Asserting it here would mean deleting the shop by hand and
  // checking a role nothing in the test had changed — which passes whatever the
  // action does.

  it('does not take the owner account with it', async () => {
    await testDb.shop.delete({ where: { id: shopId } });
    const owner = await testDb.user.findUnique({ where: { id: ownerId } });
    // The person still exists; only their storefront is gone. Deleting the
    // account is a separate, DPDP-governed act with its own action.
    expect(owner).not.toBeNull();
  });

});
