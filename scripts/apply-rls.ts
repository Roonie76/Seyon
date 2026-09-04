/**
 * Applies row-level security to every table in `public`.
 *
 * Separate from `db:indexes` because the two answer different questions and
 * should be runnable independently — one is performance, one is exposure.
 *
 *   npm run db:rls
 *
 * Idempotent, and it reports what it found rather than only what it did: a
 * table left without RLS after this runs is a table PostgREST will serve to
 * anyone holding the anon key.
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import path from 'path';
import { Client } from 'pg';

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('Neither DIRECT_URL nor DATABASE_URL is set.');
    process.exit(1);
  }
  console.log(`applying row-level security on ${new URL(url).host}`);

  const sql = readFileSync(path.join(__dirname, '..', 'prisma', 'sql', 'row-level-security.sql'), 'utf8');
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(sql);

    const { rows } = await client.query<{ relname: string; forced: boolean }>(
      `SELECT c.relname, c.relforcerowsecurity AS forced
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
        ORDER BY c.relname`
    );
    if (rows.length > 0) {
      console.error(
        `\nWARNING: ${rows.length} table(s) still have RLS disabled and are readable ` +
          `through PostgREST with the anon key:\n  ${rows.map((r) => r.relname).join('\n  ')}\n` +
          'A table created after this file was written needs adding to it.'
      );
      process.exitCode = 1;
      return;
    }

    // FORCE is the one setting that would break the application, so the script
    // that manages RLS is the right place to notice it has appeared.
    const { rows: forced } = await client.query<{ relname: string }>(
      `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relforcerowsecurity`
    );
    if (forced.length > 0) {
      console.error(
        `\nWARNING: FORCE ROW LEVEL SECURITY is set on ${forced.map((r) => r.relname).join(', ')}. ` +
          'That strips the owner exemption Prisma relies on — those queries will fail.'
      );
      process.exitCode = 1;
      return;
    }

    console.log('every table in public has row-level security, none forced.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Failed to apply row-level security:', err);
  process.exit(1);
});
