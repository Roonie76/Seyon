/**
 * Fixtures for the browser suites.
 *
 * These used to be created by hand before each Playwright run, which meant the
 * e2e suite passed on one machine and failed on the next for reasons nobody had
 * written down. It also meant a suite that deletes a product and suspends a
 * store — which admin.spec.ts does, deliberately — could only be run once.
 *
 * Everything here is deleted and rebuilt on each invocation, so the suites are
 * repeatable:
 *
 *   npm run db:e2e-fixtures && npm run test:e2e
 */
import 'dotenv/config';
import { PrismaClient, Role, ReportCategory, NoticeKind } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set.');

// Refuse to touch anything that looks like the live database. These fixtures
// delete rows by email prefix, and a prefix collision against production would
// be unrecoverable.
if (/supabase\.(com|co)|amazonaws\.com/i.test(url) && !process.env.ALLOW_REMOTE_FIXTURES) {
  throw new Error(
    'DATABASE_URL points at a hosted database. Fixtures only run against a local database; ' +
      'set ALLOW_REMOTE_FIXTURES=1 if you genuinely mean to do this.'
  );
}

const pool = new pg.Pool({ connectionString: url });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

const ADMIN = 'admintest@example.com';
const ADMIN2 = 'admintest2@example.com';
const OWNER = 'adminowner@example.com';
const BUYERS = ['adminbuyer1@example.com', 'adminbuyer2@example.com', 'adminbuyer3@example.com'];
const SHOP_SLUG = 'admin-test-store';

// kyc.spec.ts drives a store from unverified and unlisted through to listed,
// so its fixture starts deliberately unlisted with no identity on file.
const KYC_SELLER = 'kycseller@example.com';
const KYC_ADMIN = 'kycadmin@example.com';
const KYC_SHOP_SLUG = 'verification-test-store';

// audit-regression.spec.ts logs in as this seller and creates products through
// the real dashboard, so all it needs is an account with a shop attached.
const AUDIT_SELLER = 'seller1@audit.test';
const AUDIT_SHOP_SLUG = 'audit-shop'; // hardcoded in audit-regression.spec.ts

const HOUR = 3_600_000;

async function main() {
  const emails = [ADMIN, ADMIN2, OWNER, KYC_SELLER, KYC_ADMIN, AUDIT_SELLER, ...BUYERS];

  // Order matters: notices and audit rows hold Restrict references to users.
  const shopSlugs = [SHOP_SLUG, KYC_SHOP_SLUG, AUDIT_SHOP_SLUG];
  await db.notice.deleteMany({ where: { shop: { slug: { in: shopSlugs } } } });
  await db.adminAction.deleteMany({ where: { actor: { email: { in: emails } } } });
  await db.sellerKyc.deleteMany({ where: { user: { email: { in: emails } } } });
  await db.report.deleteMany({ where: { shop: { slug: { in: shopSlugs } } } });
  await db.review.deleteMany({ where: { shop: { slug: { in: shopSlugs } } } });
  await db.shop.deleteMany({ where: { slug: { in: shopSlugs } } });
  await db.user.deleteMany({ where: { email: { in: emails } } });

  const admin = await db.user.create({
    data: { email: ADMIN, name: 'Admin Tester', role: Role.ADMIN },
  });

  // A second admin exists so the access screen has something to demote. With
  // one admin the last-admin guard fires and the control is not even rendered,
  // which would make the role tests untestable rather than passing.
  await db.user.create({
    data: { email: ADMIN2, name: 'Second Admin', role: Role.ADMIN },
  });

  const owner = await db.user.create({
    data: { email: OWNER, name: 'Admin Owner', role: Role.SELLER },
  });

  const shop = await db.shop.create({
    data: {
      ownerId: owner.id,
      name: 'Admin Test Store',
      slug: SHOP_SLUG,
      description: 'A store that exists so the admin screens have something to act on.',
      whatsapp: '919700000001',
      city: 'Chennai',
      isListed: true,
    },
  });

  await db.product.create({
    data: {
      shopId: shop.id,
      title: 'Admin Test Widget',
      slug: 'admin-test-widget',
      description: 'One product, so the delete-with-a-reason path has a target.',
      price: 499,
      category: 'Other',
      status: 'ACTIVE',
    },
  });

  // Three reviews: 5, 5, 1. Average 3.7 with all of them, 5.0 once the 1 is
  // hidden — a difference the browser test can actually see on the page.
  const buyers = [];
  for (const [i, email] of BUYERS.entries()) {
    buyers.push(await db.user.create({ data: { email, name: `Admin Buyer ${i + 1}` } }));
  }

  const ratings = [5, 5, 1];
  const comments = [
    'Fast replies and the item was exactly as described.',
    'Good packaging, would buy again.',
    'This seller is a fraud and steals from people.',
  ];
  for (const [i, buyer] of buyers.entries()) {
    await db.review.create({
      data: { shopId: shop.id, userId: buyer.id, rating: ratings[i], comment: comments[i] },
    });
  }

  const total = ratings.reduce((a, b) => a + b, 0);
  await db.shop.update({
    where: { id: shop.id },
    data: {
      averageRating: Math.round((total / ratings.length) * 10) / 10,
      reviewCount: ratings.length,
    },
  });

  // One complaint filed three days ago and never acknowledged — the overdue
  // case — and one filed just now, so the queue shows both states.
  await db.report.create({
    data: {
      shopId: shop.id,
      userId: buyers[0].id,
      category: ReportCategory.COUNTERFEIT,
      reason: 'The perfume they sent is a counterfeit of a brand I know well.',
      createdAt: new Date(Date.now() - 72 * HOUR),
    },
  });

  await db.report.create({
    data: {
      shopId: shop.id,
      userId: buyers[1].id,
      category: ReportCategory.MISLEADING_LISTING,
      reason: 'The listing price and the price quoted on WhatsApp are different.',
    },
  });

  // One already-read notice, so the inbox has both states to render.
  await db.notice.create({
    data: {
      shopId: shop.id,
      actorId: admin.id,
      kind: NoticeKind.WARNING,
      subject: 'Please check your listing prices',
      body: 'A buyer reported that your listed price and your quoted price differ. Please make them match.',
      readAt: new Date(),
    },
  });

  // --- KYC suite ---------------------------------------------------------
  await db.user.create({ data: { email: KYC_ADMIN, name: 'KYC Admin', role: Role.ADMIN } });
  const kycSeller = await db.user.create({
    data: { email: KYC_SELLER, name: 'KYC Seller', role: Role.SELLER },
  });
  const kycShop = await db.shop.create({
    data: {
      ownerId: kycSeller.id,
      name: 'Verification Test Store',
      slug: KYC_SHOP_SLUG,
      description: 'Starts unlisted, so the identity gate has something to open.',
      whatsapp: '919700000002',
      // Tier 0 refuses to list a store whose WhatsApp number has never been
      // proven, so the fixture arrives with that step already done — the suite
      // is testing the identity gate, not the phone gate.
      whatsappVerifiedAt: new Date(),
      city: 'Chennai',
      isListed: false,
    },
  });
  await db.product.create({
    data: {
      shopId: kycShop.id,
      title: 'Verification Test Candle',
      slug: 'verification-test-candle',
      description: 'Invisible in discovery until its seller completes Tier 0.',
      price: 299,
      category: 'Home & Living',
      status: 'ACTIVE',
    },
  });

  // --- audit regression suite ---------------------------------------------
  const auditSeller = await db.user.create({
    data: { email: AUDIT_SELLER, name: 'Audit Seller', role: Role.SELLER },
  });
  const auditShop = await db.shop.create({
    data: {
      ownerId: auditSeller.id,
      name: 'Audit Regression Store',
      slug: AUDIT_SHOP_SLUG,
      description: 'Products are created and destroyed here by the regression suite.',
      whatsapp: '919700000003',
      whatsappVerifiedAt: new Date(),
      city: 'Coimbatore',
      isListed: true,
    },
  });

  console.log(
    `Fixtures ready: ${shop.slug} (${ratings.length} reviews, 2 complaints, 1 notice), ` +
      `${kycShop.slug} (unlisted), ${auditShop.slug}, 3 admins.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
