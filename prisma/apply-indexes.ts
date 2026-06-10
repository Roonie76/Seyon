/**
 * Applies raw SQL indexes that cannot be expressed in schema.prisma
 * (expression GIN indexes for full-text search + pg_trgm).
 *
 * Usage: npm run db:indexes
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import path from 'path';
import { Client } from 'pg';

async function main() {
  const sql = readFileSync(path.join(__dirname, 'sql', 'fts-indexes.sql'), 'utf8');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(sql);
    console.log('Search indexes applied successfully.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Failed to apply search indexes:', err);
  process.exit(1);
});
