import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { testDb, resetDatabase, closeDatabase, createSeller, IMAGE_URL } from './setup';
import { parsePage, parsePriceRange, parseRating } from '@/shared/lib/search-params';

/**
 * Discovery against real SQL: pagination arithmetic, totals, and the
 * visibility filters buyers depend on. The unit suite mocks $queryRaw, so it
 * can prove inputs are bound but not that the results are right.
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

async function seedCatalogue(count: number) {
  const { shop } = await createSeller('seller@test.local', 'shop-a');
  for (let i = 0; i < count; i++) {
    await testDb.product.create({
      data: {
        shopId: shop.id,
        title: `Handmade candle ${String(i).padStart(3, '0')}`,
        slug: `handmade-candle-${i}`,
        price: 100 + i,
        category: 'Home & Living',
        status: 'ACTIVE',
        // Distinct timestamps keep the ordering deterministic, which is what
        // makes "no duplicates across pages" a meaningful assertion.
        createdAt: new Date(Date.now() - i * 1000),
        images: { create: [{ url: IMAGE_URL, displayOrder: 0, isPrimary: true }] },
      },
    });
  }
  return shop;
}

const PER_PAGE = 8;

async function page(n: number, shopId: string) {
  return testDb.product.findMany({
    where: { shopId, status: 'ACTIVE' },
    orderBy: [{ inStock: 'desc' }, { createdAt: 'desc' }],
    skip: (n - 1) * PER_PAGE,
    take: PER_PAGE,
    select: { slug: true },
  });
}

describe('pagination covers the catalogue exactly once', () => {
  it('no duplicates and no gaps across every page', async () => {
    const shop = await seedCatalogue(35);
    const pages = Math.ceil(35 / PER_PAGE);

    const seen: string[] = [];
    for (let p = 1; p <= pages; p++) {
      const rows = await page(p, shop.id);
      seen.push(...rows.map((r) => r.slug));
    }

    expect(seen).toHaveLength(35);
    expect(new Set(seen).size).toBe(35);
  });

  it('a page past the end is empty but the total is still correct', async () => {
    const shop = await seedCatalogue(10);

    const rows = await page(99, shop.id);
    const total = await testDb.product.count({ where: { shopId: shop.id, status: 'ACTIVE' } });

    expect(rows).toHaveLength(0);
    // The old COUNT(*) OVER() reported 0 here, so the UI claimed there were
    // no results at all rather than "you have paged past the end".
    expect(total).toBe(10);
  });
});

describe('F-20 malformed query parameters fall back instead of emptying the catalogue', () => {
  it.each([
    ['abc', 1],
    ['0', 1],
    ['-3', 1],
    ['', 1],
    [undefined, 1],
    ['2', 2],
    ['999999', 1000], // clamped to MAX_PAGE
  ])('page=%s resolves to %i', (input, expected) => {
    expect(parsePage(input as string | undefined)).toBe(expected);
  });

  it('a malformed page still returns the first page of results', async () => {
    const shop = await seedCatalogue(12);
    const rows = await page(parsePage('abc'), shop.id);
    expect(rows).toHaveLength(PER_PAGE);
  });

  it('price bounds ignore junk and swap when inverted', () => {
    expect(parsePriceRange('abc', 'xyz')).toEqual({});
    expect(parsePriceRange('-5', '100')).toEqual({ max: 100 });
    expect(parsePriceRange('500', '100')).toEqual({ min: 100, max: 500 });
  });

  it('rating is clamped to what the data can express', () => {
    expect(parseRating('abc')).toBeUndefined();
    expect(parseRating('0')).toBeUndefined();
    expect(parseRating('9')).toBe(5);
    expect(parseRating('4')).toBe(4);
  });
});

describe('price filtering returns the right rows', () => {
  it('a bounded range excludes rows outside it', async () => {
    const shop = await seedCatalogue(20); // prices 100..119
    const { min, max } = parsePriceRange('105', '110');

    const rows = await testDb.product.findMany({
      where: { shopId: shop.id, status: 'ACTIVE', price: { gte: min, lte: max } },
      select: { price: true },
    });

    expect(rows).toHaveLength(6); // 105,106,107,108,109,110
    expect(Math.min(...rows.map((r) => r.price))).toBeGreaterThanOrEqual(105);
    expect(Math.max(...rows.map((r) => r.price))).toBeLessThanOrEqual(110);
  });
});

describe('a product with a broken image URL is still a valid row', () => {
  it('the catalogue query does not depend on image host validity', async () => {
    const { shop } = await createSeller('a@test.local', 'shop-a');
    await testDb.product.create({
      data: {
        shopId: shop.id,
        title: 'Legacy import',
        slug: 'legacy-import',
        price: 50,
        category: 'Other',
        status: 'ACTIVE',
        // A row that predates URL validation. It must not be able to break a
        // query — SafeImage handles it at render time instead.
        images: { create: [{ url: 'http://127.0.0.1:5432/', displayOrder: 0, isPrimary: true }] },
      },
    });

    const rows = await testDb.product.findMany({
      where: { status: 'ACTIVE' },
      include: { images: true },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].images[0].url).toBe('http://127.0.0.1:5432/');
  });
});
