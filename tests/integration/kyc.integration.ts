import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { testDb, closeDatabase } from './setup';
import { DISCOVERABLE_SHOP, VISIBLE_SHOP } from '@/backend/lib/shop-visibility';

/**
 * The listing gate, against a real database.
 *
 * The property that matters: an unlisted shop is absent from every discovery
 * query but still reachable by direct link. Getting that backwards in either
 * direction is bad — leak an unverified seller into the marketplace, or 404 a
 * seller trying to preview their own storefront.
 *
 * These run against the schema, not against a mock, because the gate is a
 * database predicate and a mock would happily agree with a wrong one.
 */

let listedShopId = '';
let unlistedShopId = '';

beforeAll(async () => {
  await testDb.$connect();
});

beforeEach(async () => {
  await testDb.product.deleteMany({ where: { shop: { slug: { startsWith: 'kyc-test-' } } } });
  await testDb.sellerKyc.deleteMany({ where: { user: { email: { startsWith: 'kyc-test-' } } } });
  await testDb.shop.deleteMany({ where: { slug: { startsWith: 'kyc-test-' } } });
  await testDb.user.deleteMany({ where: { email: { startsWith: 'kyc-test-' } } });

  const listedOwner = await testDb.user.create({
    data: { email: 'kyc-test-listed@example.com', name: 'Listed Owner', role: 'SELLER' },
  });
  const unlistedOwner = await testDb.user.create({
    data: { email: 'kyc-test-unlisted@example.com', name: 'Unlisted Owner', role: 'SELLER' },
  });

  const listed = await testDb.shop.create({
    data: {
      ownerId: listedOwner.id,
      name: 'Listed Shop',
      slug: 'kyc-test-listed',
      whatsapp: '919000000001',
      isListed: true,
    },
  });
  const unlisted = await testDb.shop.create({
    data: {
      ownerId: unlistedOwner.id,
      name: 'Unlisted Shop',
      slug: 'kyc-test-unlisted',
      whatsapp: '919000000002',
      isListed: false,
    },
  });
  listedShopId = listed.id;
  unlistedShopId = unlisted.id;

  for (const shopId of [listed.id, unlisted.id]) {
    await testDb.product.create({
      data: {
        shopId,
        title: 'Test Product',
        slug: `kyc-test-product-${shopId.slice(-6)}`,
        price: 500,
        category: 'Home',
        status: 'ACTIVE',
      },
    });
  }
});

afterAll(async () => {
  await testDb.product.deleteMany({ where: { shop: { slug: { startsWith: 'kyc-test-' } } } });
  await testDb.sellerKyc.deleteMany({ where: { user: { email: { startsWith: 'kyc-test-' } } } });
  await testDb.shop.deleteMany({ where: { slug: { startsWith: 'kyc-test-' } } });
  await testDb.user.deleteMany({ where: { email: { startsWith: 'kyc-test-' } } });
  await closeDatabase();
});

describe('listing gate', () => {
  it('keeps an unlisted shop out of discovery', async () => {
    const found = await testDb.shop.findMany({
      where: { ...DISCOVERABLE_SHOP, slug: { startsWith: 'kyc-test-' } },
      select: { slug: true },
    });
    expect(found.map((s) => s.slug)).toEqual(['kyc-test-listed']);
  });

  it('keeps an unlisted shop reachable by direct link', async () => {
    const shop = await testDb.shop.findFirst({
      where: { ...VISIBLE_SHOP, slug: 'kyc-test-unlisted' },
    });
    expect(shop).not.toBeNull();
    expect(shop?.slug).toBe('kyc-test-unlisted');
  });

  it('hides products belonging to an unlisted shop from discovery', async () => {
    const products = await testDb.product.findMany({
      where: { status: 'ACTIVE', shop: { ...DISCOVERABLE_SHOP, slug: { startsWith: 'kyc-test-' } } },
      select: { shopId: true },
    });
    expect(products).toHaveLength(1);
    expect(products[0].shopId).toBe(listedShopId);
  });

  it('lists a shop as soon as the flag flips, with no other change', async () => {
    await testDb.shop.update({ where: { id: unlistedShopId }, data: { isListed: true } });
    const found = await testDb.shop.findMany({
      where: { ...DISCOVERABLE_SHOP, slug: { startsWith: 'kyc-test-' } },
      select: { slug: true },
      orderBy: { slug: 'asc' },
    });
    expect(found.map((s) => s.slug)).toEqual(['kyc-test-listed', 'kyc-test-unlisted']);
  });

  it('still hides a listed shop once it is suspended', async () => {
    await testDb.shop.update({ where: { id: listedShopId }, data: { isSuspended: true } });
    const found = await testDb.shop.findMany({
      where: { ...DISCOVERABLE_SHOP, slug: { startsWith: 'kyc-test-' } },
    });
    expect(found).toHaveLength(0);
  });
});

describe('SellerKyc constraints', () => {
  it('refuses a rejection with no reason', async () => {
    const user = await testDb.user.findFirstOrThrow({
      where: { email: 'kyc-test-listed@example.com' },
    });
    await testDb.sellerKyc.create({ data: { userId: user.id, legalName: 'A Seller' } });

    await expect(
      testDb.sellerKyc.update({
        where: { userId: user.id },
        data: { status: 'REJECTED' },
      })
    ).rejects.toThrow();
  });

  it('accepts a rejection that says why', async () => {
    const user = await testDb.user.findFirstOrThrow({
      where: { email: 'kyc-test-listed@example.com' },
    });
    await testDb.sellerKyc.create({ data: { userId: user.id, legalName: 'A Seller' } });

    const updated = await testDb.sellerKyc.update({
      where: { userId: user.id },
      data: { status: 'REJECTED', rejectionReason: 'Document was unreadable.' },
    });
    expect(updated.status).toBe('REJECTED');
  });

  it('refuses a pending review with no submission time', async () => {
    const user = await testDb.user.findFirstOrThrow({
      where: { email: 'kyc-test-unlisted@example.com' },
    });
    await testDb.sellerKyc.create({ data: { userId: user.id, legalName: 'B Seller' } });

    await expect(
      testDb.sellerKyc.update({
        where: { userId: user.id },
        data: { status: 'PENDING_REVIEW' },
      })
    ).rejects.toThrow();
  });

  it('refuses to store more than four characters of an identifier', async () => {
    const user = await testDb.user.findFirstOrThrow({
      where: { email: 'kyc-test-listed@example.com' },
    });
    await expect(
      testDb.sellerKyc.create({
        data: { userId: user.id, legalName: 'A Seller', idLast4: 'ABCPE1234F' },
      })
    ).rejects.toThrow();
  });

  it('allows one KYC record per user, never two', async () => {
    const user = await testDb.user.findFirstOrThrow({
      where: { email: 'kyc-test-listed@example.com' },
    });
    await testDb.sellerKyc.create({ data: { userId: user.id, legalName: 'A Seller' } });
    await expect(
      testDb.sellerKyc.create({ data: { userId: user.id, legalName: 'Duplicate' } })
    ).rejects.toThrow();
  });

  it('takes the KYC record with the account when it is erased', async () => {
    const user = await testDb.user.findFirstOrThrow({
      where: { email: 'kyc-test-unlisted@example.com' },
    });
    await testDb.sellerKyc.create({ data: { userId: user.id, legalName: 'B Seller' } });

    await testDb.user.delete({ where: { id: user.id } });

    const orphan = await testDb.sellerKyc.findFirst({ where: { userId: user.id } });
    expect(orphan).toBeNull();
  });
});
