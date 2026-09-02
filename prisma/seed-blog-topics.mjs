/**
 * Seeds the five hubs that used to live in src/shared/blog/topics.ts.
 *
 * Idempotent: an upsert keyed on slug, so running it against a database that
 * already has them (or has edited copies of them) is safe. Existing rows keep
 * whatever an editor has since changed - the seed only fills in what is
 * missing, it does not overwrite the admin screen's work.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { readFileSync } from 'node:fs';

const TOPICS = JSON.parse(readFileSync(new URL('./blog-topics.seed.json', import.meta.url), 'utf8'));

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
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
