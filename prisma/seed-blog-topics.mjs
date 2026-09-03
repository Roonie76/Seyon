/**
 * Seeds the five hubs that used to live in src/shared/blog/topics.ts.
 *
 * Idempotent: an upsert keyed on slug, so running it against a database that
 * already has them (or has edited copies of them) is safe. Existing rows keep
 * whatever an editor has since changed - the seed only fills in what is
 * missing, it does not overwrite the admin screen's work.
 */
// This is run by hand, against production, exactly once. `node` does not read
// `.env`, and without it Prisma fails with P1010 "User was denied access on
// the database (not available)" - which reads like a credentials problem and
// sends you looking at Postgres instead of at an unset variable.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { readFileSync } from 'node:fs';

const TOPICS = JSON.parse(readFileSync(new URL('./blog-topics.seed.json', import.meta.url), 'utf8'));

/**
 * Say which database is about to be written to, before writing to it.
 *
 * The whole risk in this script is running it against the wrong one - a local
 * `.env` pointing at localhost while you believe you are seeding Supabase.
 * Printing the host costs nothing and makes that mistake visible.
 */
const raw = process.env.DATABASE_URL;
if (!raw) {
  console.error('DATABASE_URL is not set. Point it at the database you mean to seed.');
  process.exit(1);
}
console.log(`seeding blog topics into ${new URL(raw).host}`);

const pool = new pg.Pool({ connectionString: raw });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

let created = 0, kept = 0;
for (const [i, t] of TOPICS.entries()) {
  const existing = await db.blogTopic.findUnique({ where: { slug: t.slug } });
  if (existing) { kept++; continue; }
  await db.blogTopic.create({ data: { ...t, sortOrder: i } });
  created++;
}
console.log(`blog topics: ${created} created, ${kept} already present`);
await db.$disconnect();
await pool.end();
