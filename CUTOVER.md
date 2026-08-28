# URGENT — Seyon is down. Here is the fix.

Production returns `503 {"status":"degraded","db":"down"}`. The Seoul project was
deleted while both Vercel projects still point at it. **Your data is safe** — it is
in Mumbai (`wcmldqrlppclprpcyjso`), re-verified after the deletion: 22 products,
10 shops, 14 users, 326 analytics rows, 20 storage files.

There is no rollback any more. Seoul is gone. The only way out is forward.

---

## Step 1 — prove the connection string works (10 seconds, do this first)

I could never test this from my sandbox: ports 5432/6543 are blocked there, which is
why the whole migration went over HTTPS. The string below is **constructed, not
proven**. Test it before you change anything, so you are not debugging a bad string
and a down site at the same time.

Run in a normal Windows terminal (PowerShell or cmd — **not** the Cowork VM, which
has no network):

    psql "postgresql://postgres.wcmldqrlppclprpcyjso:Kadambur%257676@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require" -c "select count(*) from \"Product\";"

- Returns **22** → the string is right. Go to step 2.
- Authentication error → try `Kadambur%7676` instead of `Kadambur%257676`.
  One of the two is correct; that test tells you which in one attempt.
- No `psql` installed → skip it, use the string with `%25` in step 2, and if the
  deploy fails on auth, swap to the un-escaped form and redeploy.

**Why this matters:** `%76` is a valid URL escape for the letter `v`, so
`Kadambur%7676` silently becomes `Kadamburv76` and fails as a *wrong password*
rather than a malformed URL.

## Step 2 — set the variables on BOTH Vercel projects

You have two, matching your two-host setup. **Both** need this or the seller side stays down:

- `seyon`         (prj_7kiIDzxUu1ZaAEaPdvXnd8b0CfmX)
- `seyon-seller`  (prj_fb40cyXU2I8x6yDPrOH8UdV6prDM)

For each, in Settings → Environment Variables, set these for **Production, Preview and
Development**:

```
DATABASE_URL   postgresql://postgres.wcmldqrlppclprpcyjso:Kadambur%257676@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL     postgresql://postgres.wcmldqrlppclprpcyjso:Kadambur%257676@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
SUPABASE_URL   https://wcmldqrlppclprpcyjso.supabase.co
SUPABASE_ANON_KEY
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjbWxkcXJscHBjbHBycGN5anNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MDg3ODUsImV4cCI6MjEwMzA4NDc4NX0.SM2UFwl0kUNjo8wjidsMyYIya0MVMX1w75AR_ELFKyE
SUPABASE_SERVICE_ROLE_KEY
  copy from Supabase dashboard - Settings > API Keys - service_role
  (do not paste it into chat)
```

Update your local `.env` with the same five values.

## Step 3 — redeploy both projects

Redeploy from the Vercel dashboard, or `git commit --allow-empty -m "chore: repoint to Mumbai" && git push`.

## Step 4 — confirm it is back

    https://<your-domain>/api/health

Expect `200` and `"db":"ok"`. Then check a storefront page renders products, and a
product page renders images.

---

## What is in Mumbai, verified

| | |
|---|---|
| schema | 3 migrations; 14 tables, 9 CHECK constraints, 41 indexes |
| rows | 403 across 13 tables, every field byte-identical to Seoul before deletion |
| storage | 20 files, 3.8 MB, all md5-identical; buckets logos/banners/products, public |
| search | `Product_fts_idx`, `Product_title_trgm_idx`, `pg_trgm` — applied and tested |
| `_prisma_migrations` | seeded, so `migrate deploy` will not re-run anything |

### A near miss worth knowing about

The full-text search indexes are **not** in the migrations. They live in
`prisma/sql/fts-indexes.sql` and are applied by hand with `npm run db:indexes`, so
the schema migration alone did not create them. I caught this from the repo after you
deleted Seoul and applied them — search would otherwise have quietly fallen back to
sequential scans. `fts-indexes.sql` is the only out-of-band SQL in the repo; I checked.

### What I could not verify, because Seoul is gone

I recorded and compared tables, columns, every row, storage objects, buckets and
`auth.users` (which was 0 — NextAuth uses its own `User` table). I did **not**
snapshot custom database functions, triggers, or RLS policies before deletion, and I
can no longer diff them. For a Prisma-managed app that connects as `postgres` these
are usually absent or bypassed, and nothing in your repo creates any — but I cannot
prove it now, so I am telling you rather than implying full coverage.

---

## Once you are back up

1. Revoke the `sbp_` access token.
2. Change the Mumbai database password — `Kadambur%7676` was pasted into chat, and
   it is also the old Seoul password. Then update the two Vercel projects again.
3. Deploy the `fix/audit-2026-08` branch: it carries `vercel.json` pinning `bom1`.
   Production currently serves from `iad1` (Washington), so your app is in Virginia
   talking to a database in Mumbai — worse latency than before the move until you merge it.
