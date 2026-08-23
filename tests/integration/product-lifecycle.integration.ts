import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import {
  testDb,
  resetDatabase,
  closeDatabase,
  createSeller,
  createProduct,
  IMAGE_URL,
} from './setup';
import { recomputeShopRating, displayRating } from '@/backend/lib/shop-ratings';

/**
 * Behaviour that only a real database can demonstrate: constraints, cascades,
 * transactional isolation and lost-update prevention.
 */

beforeAll(async () => {
  await testDb.$connect();
});

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe('slug uniqueness is enforced by the database, not just the app', () => {
  it('rejects a duplicate slug within the same shop', async () => {
    const { shop } = await createSeller('a@test.local', 'shop-a');
    await createProduct(shop.id, { slug: 'same-slug' });

    await expect(createProduct(shop.id, { slug: 'same-slug' })).rejects.toThrow();
  });

  it('allows the same slug in two different shops', async () => {
    const a = await createSeller('a@test.local', 'shop-a');
    const b = await createSeller('b@test.local', 'shop-b');

    await createProduct(a.shop.id, { slug: 'shared' });
    await expect(createProduct(b.shop.id, { slug: 'shared' })).resolves.toBeTruthy();
  });
});

describe('F-04 optimistic concurrency prevents a lost update', () => {
  it('a write carrying a stale updatedAt matches zero rows', async () => {
    const { shop } = await createSeller('a@test.local', 'shop-a');
    const product = await createProduct(shop.id, { price: 100 });
    const staleVersion = product.updatedAt;

    // First writer wins and moves updatedAt forward.
    await testDb.product.updateMany({
      where: { id: product.id, updatedAt: staleVersion },
      data: { price: 999 },
    });

    // Second writer, holding the version it originally read, must not land.
    const second = await testDb.product.updateMany({
      where: { id: product.id, updatedAt: staleVersion },
      data: { price: 1 },
    });

    expect(second.count).toBe(0);
    const final = await testDb.product.findUnique({ where: { id: product.id } });
    expect(final?.price).toBe(999);
  });

  it('two genuinely concurrent guarded writes produce exactly one winner', async () => {
    const { shop } = await createSeller('a@test.local', 'shop-a');
    const product = await createProduct(shop.id, { price: 100 });
    const version = product.updatedAt;

    const [a, b] = await Promise.all([
      testDb.product.updateMany({
        where: { id: product.id, updatedAt: version },
        data: { price: 200 },
      }),
      testDb.product.updateMany({
        where: { id: product.id, updatedAt: version },
        data: { price: 300 },
      }),
    ]);

    expect(a.count + b.count).toBe(1);
  });
});

describe('cascades leave no orphans', () => {
  it('deleting a product removes its images', async () => {
    const { shop } = await createSeller('a@test.local', 'shop-a');
    const product = await createProduct(shop.id);
    expect(product.images).toHaveLength(1);

    await testDb.product.delete({ where: { id: product.id } });

    const orphans = await testDb.productImage.count({ where: { productId: product.id } });
    expect(orphans).toBe(0);
  });

  it('deleting a shop removes its products and images', async () => {
    const { shop } = await createSeller('a@test.local', 'shop-a');
    await createProduct(shop.id);
    await createProduct(shop.id);

    await testDb.shop.delete({ where: { id: shop.id } });

    expect(await testDb.product.count()).toBe(0);
    expect(await testDb.productImage.count()).toBe(0);
  });

  it('deleting a product nulls the analytics reference rather than deleting history', async () => {
    const { shop } = await createSeller('a@test.local', 'shop-a');
    const product = await createProduct(shop.id);
    await testDb.analytics.create({
      data: { shopId: shop.id, productId: product.id, eventType: 'PRODUCT_VIEW' },
    });

    await testDb.product.delete({ where: { id: product.id } });

    const rows = await testDb.analytics.findMany({ where: { shopId: shop.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].productId).toBeNull();
  });
});

describe('F-19b the cached shop rating is the single source of truth', () => {
  it('recompute matches the reviews it summarises', async () => {
    const { shop } = await createSeller('seller@test.local', 'shop-a');
    const b1 = await testDb.user.create({ data: { email: 'b1@test.local' } });
    const b2 = await testDb.user.create({ data: { email: 'b2@test.local' } });

    await testDb.review.create({
      data: { shopId: shop.id, userId: b1.id, rating: 5, comment: 'Great' },
    });
    await testDb.review.create({
      data: { shopId: shop.id, userId: b2.id, rating: 4, comment: 'Good' },
    });

    const result = await recomputeShopRating(shop.id, testDb);
    expect(result).toEqual({ averageRating: 4.5, reviewCount: 2 });

    const stored = await testDb.shop.findUnique({ where: { id: shop.id } });
    expect(stored?.averageRating).toBe(4.5);
    expect(stored?.reviewCount).toBe(2);
  });

  it('recompute after a review disappears leaves no stale aggregate', async () => {
    const { shop } = await createSeller('seller@test.local', 'shop-a');
    const buyer = await testDb.user.create({ data: { email: 'b@test.local' } });
    const review = await testDb.review.create({
      data: { shopId: shop.id, userId: buyer.id, rating: 5, comment: 'Great' },
    });
    await recomputeShopRating(shop.id, testDb);

    await testDb.review.delete({ where: { id: review.id } });
    const after = await recomputeShopRating(shop.id, testDb);

    expect(after).toEqual({ averageRating: 0, reviewCount: 0 });
    expect(displayRating(after)).toBeNull();
  });

  it('one review per buyer per shop', async () => {
    const { shop } = await createSeller('seller@test.local', 'shop-a');
    const buyer = await testDb.user.create({ data: { email: 'b@test.local' } });
    await testDb.review.create({
      data: { shopId: shop.id, userId: buyer.id, rating: 5, comment: 'Great' },
    });

    await expect(
      testDb.review.create({
        data: { shopId: shop.id, userId: buyer.id, rating: 1, comment: 'Changed my mind' },
      })
    ).rejects.toThrow();
  });
});

describe('image reconciliation keeps ids stable across an edit', () => {
  it('an image that survives an update keeps its id', async () => {
    const { shop } = await createSeller('a@test.local', 'shop-a');
    const product = await createProduct(shop.id);
    const originalId = product.images[0].id;
    const secondUrl = `${IMAGE_URL}?v=2`;

    // Mirrors updateProduct: reconcile by URL rather than delete-and-recreate.
    await testDb.$transaction(async (tx) => {
      const existing = await tx.productImage.findMany({ where: { productId: product.id } });
      const byUrl = new Map(existing.map((i) => [i.url, i.id]));
      const desired = [IMAGE_URL, secondUrl];

      const removed = existing.filter((i) => !desired.includes(i.url)).map((i) => i.id);
      if (removed.length) await tx.productImage.deleteMany({ where: { id: { in: removed } } });

      for (const [idx, url] of desired.entries()) {
        const kept = byUrl.get(url);
        if (kept) {
          await tx.productImage.update({
            where: { id: kept },
            data: { displayOrder: idx, isPrimary: idx === 0 },
          });
        } else {
          await tx.productImage.create({
            data: { productId: product.id, url, displayOrder: idx, isPrimary: idx === 0 },
          });
        }
      }
    });

    const after = await testDb.productImage.findMany({
      where: { productId: product.id },
      orderBy: { displayOrder: 'asc' },
    });
    expect(after).toHaveLength(2);
    expect(after[0].id).toBe(originalId); // survived, so a held id is still valid
  });
});

describe('catalogue visibility filters', () => {
  it('a paused or suspended shop is excluded from marketplace queries', async () => {
    const open = await createSeller('open@test.local', 'open-shop');
    const paused = await createSeller('paused@test.local', 'paused-shop');
    const suspended = await createSeller('susp@test.local', 'susp-shop');

    await createProduct(open.shop.id);
    await createProduct(paused.shop.id);
    await createProduct(suspended.shop.id);

    await testDb.shop.update({ where: { id: paused.shop.id }, data: { isPaused: true } });
    await testDb.shop.update({ where: { id: suspended.shop.id }, data: { isSuspended: true } });

    const visible = await testDb.product.findMany({
      where: { status: 'ACTIVE', shop: { isSuspended: false, isPaused: false } },
      include: { shop: true },
    });

    expect(visible).toHaveLength(1);
    expect(visible[0].shop.slug).toBe('open-shop');
  });

  it('DRAFT and ARCHIVED products never reach a buyer query', async () => {
    const { shop } = await createSeller('a@test.local', 'shop-a');
    await createProduct(shop.id, { status: 'ACTIVE' });
    await createProduct(shop.id, { status: 'DRAFT' });
    await createProduct(shop.id, { status: 'ARCHIVED' });

    const visible = await testDb.product.count({ where: { status: 'ACTIVE' } });
    expect(visible).toBe(1);
  });
});

describe('a seller may own at most one shop', () => {
  it('rejects a second shop for the same owner', async () => {
    const { user } = await createSeller('a@test.local', 'shop-a');

    await expect(
      testDb.shop.create({
        data: { ownerId: user.id, name: 'Second', slug: 'shop-two', whatsapp: '+919999999999' },
      })
    ).rejects.toThrow();
  });
});

describe('the database refuses invalid rows on its own', () => {
  it('rejects a negative price', async () => {
    const { shop } = await createSeller('a@test.local', 'shop-a');
    await expect(createProduct(shop.id, { price: -1 })).rejects.toThrow();
  });

  it('rejects an absurd price', async () => {
    const { shop } = await createSeller('a@test.local', 'shop-a');
    await expect(createProduct(shop.id, { price: 1e12 })).rejects.toThrow();
  });

  it('rejects a whitespace-only title', async () => {
    const { shop } = await createSeller('a@test.local', 'shop-a');
    await expect(createProduct(shop.id, { title: '   ' })).rejects.toThrow();
  });

  it('rejects an empty slug', async () => {
    const { shop } = await createSeller('a@test.local', 'shop-a');
    await expect(createProduct(shop.id, { slug: '' })).rejects.toThrow();
  });

  it('rejects a compare-at price below the selling price', async () => {
    const { shop } = await createSeller('a@test.local', 'shop-a');
    const p = await createProduct(shop.id, { price: 500 });
    await expect(
      testDb.product.update({ where: { id: p.id }, data: { compareAtPrice: 100 } })
    ).rejects.toThrow();
  });

  it('rejects a rating outside 1-5', async () => {
    const { shop } = await createSeller('seller@test.local', 'shop-a');
    const buyer = await testDb.user.create({ data: { email: 'b@test.local' } });
    await expect(
      testDb.review.create({
        data: { shopId: shop.id, userId: buyer.id, rating: 9, comment: 'Nope' },
      })
    ).rejects.toThrow();
  });

  it('rejects a second primary image on the same product', async () => {
    const { shop } = await createSeller('a@test.local', 'shop-a');
    const p = await createProduct(shop.id);
    await expect(
      testDb.productImage.create({
        data: { productId: p.id, url: `${IMAGE_URL}?v=2`, displayOrder: 1, isPrimary: true },
      })
    ).rejects.toThrow();
  });

  it('rejects a negative display order', async () => {
    const { shop } = await createSeller('a@test.local', 'shop-a');
    const p = await createProduct(shop.id);
    await expect(
      testDb.productImage.create({
        data: { productId: p.id, url: `${IMAGE_URL}?v=3`, displayOrder: -1, isPrimary: false },
      })
    ).rejects.toThrow();
  });
});
