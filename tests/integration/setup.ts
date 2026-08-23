import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

/**
 * Integration-test harness.
 *
 * The pre-existing suite covers pure helpers only — no test exercised a server
 * action, a database mutation, or a rendered page, which is why 100 passing
 * tests caught none of the audit findings. These run against a real Postgres
 * so constraints, transactions and concurrency behave the way they will in
 * production.
 *
 * Requires TEST_DATABASE_URL pointing at a throwaway database:
 *   createdb seyon_test && \
 *   TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/seyon_test \
 *     npx prisma db push
 */

const url =
  process.env.TEST_DATABASE_URL ||
  'postgresql://postgres@127.0.0.1:5432/seyon_test?schema=public';

const pool = new pg.Pool({ connectionString: url });
export const testDb = new PrismaClient({ adapter: new PrismaPg(pool) });

/** Wipe every table, respecting FK order. */
export async function resetDatabase(): Promise<void> {
  await testDb.analytics.deleteMany({});
  await testDb.report.deleteMany({});
  await testDb.review.deleteMany({});
  await testDb.wishlist.deleteMany({});
  await testDb.productImage.deleteMany({});
  await testDb.product.deleteMany({});
  await testDb.whatsappVerification.deleteMany({});
  await testDb.shop.deleteMany({});
  await testDb.session.deleteMany({});
  await testDb.account.deleteMany({});
  await testDb.user.deleteMany({});
}

export async function closeDatabase(): Promise<void> {
  await testDb.$disconnect();
  await pool.end();
}

export const IMAGE_URL =
  'https://seyontest.supabase.co/storage/v1/object/public/products/example.png';

export async function createSeller(email: string, shopSlug: string) {
  const user = await testDb.user.create({
    data: { email, name: email.split('@')[0], role: 'SELLER' },
  });
  const shop = await testDb.shop.create({
    data: {
      ownerId: user.id,
      name: shopSlug.replace(/-/g, ' '),
      slug: shopSlug,
      whatsapp: '+919876543210',
    },
  });
  return { user, shop };
}

export async function createProduct(
  shopId: string,
  overrides: Partial<{ title: string; slug: string; price: number; status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED' }> = {}
) {
  return testDb.product.create({
    data: {
      shopId,
      title: overrides.title ?? 'Test product',
      slug: overrides.slug ?? `test-product-${Math.random().toString(36).slice(2, 8)}`,
      price: overrides.price ?? 100,
      category: 'Fashion',
      status: overrides.status ?? 'ACTIVE',
      images: { create: [{ url: IMAGE_URL, displayOrder: 0, isPrimary: true }] },
    },
    include: { images: true },
  });
}
