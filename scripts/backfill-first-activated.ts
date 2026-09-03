/**
 * Stamps `firstActivatedAt` on products that were already live.
 *
 * The column decides when a product's slug freezes: a draft has never been
 * public and can still be renamed, a published listing cannot. Existing rows
 * have null in it, and the action treats a currently-ACTIVE product as
 * published regardless — so this backfill is not load-bearing for correctness.
 * It closes the one gap that check cannot: a product that was ACTIVE, has since
 * been archived to DRAFT, and would otherwise be renamed on its next edit.
 *
 * `createdAt` is the honest approximation — we have no record of the actual
 * first activation, and it is never later than the truth.
 *
 *   npx tsx scripts/backfill-first-activated.ts
 *
 * Idempotent: only touches rows where the column is still null.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  console.log(`backfilling firstActivatedAt on ${new URL(url).host}`);

  const pool = new pg.Pool({ connectionString: url });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  const pending = await db.product.findMany({
    where: { firstActivatedAt: null, status: 'ACTIVE' },
    select: { id: true, createdAt: true },
  });

  for (const p of pending) {
    await db.product.update({
      where: { id: p.id },
      data: { firstActivatedAt: p.createdAt },
    });
  }

  console.log(`${pending.length} live product${pending.length === 1 ? '' : 's'} stamped`);
  await db.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
