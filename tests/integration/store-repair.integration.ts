import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { testDb, closeDatabase } from './setup';
import { currentSlugFor } from '@/backend/lib/slug-redirect';

/**
 * Changing a store's address without losing its traffic.
 *
 * The damage from getting this wrong happens somewhere nobody is looking: links
 * a seller shared months ago, in WhatsApp messages and Instagram bios, simply
 * stop working. Nothing errors, the numbers go down, and nobody connects it to
 * a tidy-up three weeks earlier.
 */

const PREFIX = 'repair-test-';

let shopId = '';
let otherShopId = '';

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
    data: { email: `${PREFIX}owner@example.com`, name: 'Repair Owner', role: 'SELLER' },
  });
  const shop = await testDb.shop.create({
    data: { ownerId: owner.id, name: 'Repair Store', slug: `${PREFIX}typo`, whatsapp: '919000002222' },
  });
  shopId = shop.id;

  const other = await testDb.user.create({
    data: { email: `${PREFIX}other@example.com`, name: 'Other Owner', role: 'SELLER' },
  });
  const otherShop = await testDb.shop.create({
    data: { ownerId: other.id, name: 'Other Store', slug: `${PREFIX}other`, whatsapp: '919000003333' },
  });
  otherShopId = otherShop.id;
});

afterAll(async () => {
  await cleanup();
  await closeDatabase();
});

describe('old store addresses', () => {
  it('resolves an old slug to the current one', async () => {
    await testDb.shopSlugHistory.create({ data: { shopId, slug: `${PREFIX}typo` } });
    await testDb.shop.update({ where: { id: shopId }, data: { slug: `${PREFIX}fixed` } });

    expect(await currentSlugFor(`${PREFIX}typo`)).toBe(`${PREFIX}fixed`);
  });

  it('follows a chain of changes to the address in use now', async () => {
    // Two corrections in a row. Both old addresses must land on the live one,
    // not on each other.
    await testDb.shopSlugHistory.create({ data: { shopId, slug: `${PREFIX}typo` } });
    await testDb.shop.update({ where: { id: shopId }, data: { slug: `${PREFIX}second` } });
    await testDb.shopSlugHistory.create({ data: { shopId, slug: `${PREFIX}second` } });
    await testDb.shop.update({ where: { id: shopId }, data: { slug: `${PREFIX}third` } });

    expect(await currentSlugFor(`${PREFIX}typo`)).toBe(`${PREFIX}third`);
    expect(await currentSlugFor(`${PREFIX}second`)).toBe(`${PREFIX}third`);
  });

  it('will not let a freed address be taken by a different store', async () => {
    // The reason history is unique rather than unique-per-shop: reusing an old
    // address would redirect one seller's audience to a competitor.
    await testDb.shopSlugHistory.create({ data: { shopId, slug: `${PREFIX}typo` } });

    await expect(
      testDb.shopSlugHistory.create({ data: { shopId: otherShopId, slug: `${PREFIX}typo` } })
    ).rejects.toThrow();
  });

  it('resolves nothing for an address that never existed', async () => {
    expect(await currentSlugFor(`${PREFIX}never`)).toBeNull();
  });

  it('resolves nothing once the store is gone', async () => {
    // A redirect to a deleted store would be a redirect to a 404. Correct
    // behaviour is no redirect at all.
    await testDb.shopSlugHistory.create({ data: { shopId, slug: `${PREFIX}typo` } });
    await testDb.shop.delete({ where: { id: shopId } });

    expect(await currentSlugFor(`${PREFIX}typo`)).toBeNull();
  });

  it('refuses a lookup that is not a slug at all', async () => {
    // Never reaches the database with someone else's input shape.
    expect(await currentSlugFor('../../etc/passwd')).toBeNull();
    expect(await currentSlugFor("' OR 1=1--")).toBeNull();
  });

  it('takes its history with the store when the store is deleted', async () => {
    await testDb.shopSlugHistory.create({ data: { shopId, slug: `${PREFIX}typo` } });
    await testDb.shop.delete({ where: { id: shopId } });

    expect(await testDb.shopSlugHistory.count({ where: { shopId } })).toBe(0);
  });
});
