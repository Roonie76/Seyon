# Seoul to Mumbai — what happened, 24 August 2026

## Outcome

Seyon runs on `wcmldqrlppclprpcyjso` (ap-south-1, Mumbai). Both hosts healthy,
both Vercel projects executing in `bom1`. The Seoul project is deleted.

| | |
|---|---|
| `seyon-pied.vercel.app/api/health` | 200 `{"status":"ok","db":"up"}` |
| `seyon-seller.vercel.app/api/health` | 200 `{"status":"ok","db":"up"}` |
| Function region, both projects | `bom1` (was `iad1`) |
| Storefront, product page, homepage | render products, images, prices, WhatsApp CTA |

## Sequence

1. Data copied Seoul → Mumbai over HTTPS (Postgres ports were unreachable from
   the sandbox, so `pg_dump` was never an option). 403 rows, 20 storage files,
   verified field-by-field and md5-by-md5 before anything was switched.
2. Seoul was deleted before the cutover, which removed the rollback and took
   production down: both Vercel projects still named it. `/api/health` returned
   503 `"db":"down"`.
3. Env vars repointed on both projects, redeployed, verified.
4. Function region moved to `bom1` on both projects, redeployed, verified.

## What the outage taught, concretely

**Deleting the old project before repointing the app is what caused the
downtime** — not the migration itself. The data was already safe. The order was
wrong: repoint, verify, *then* delete, with a week's gap before deletion.

**Search indexes are not in the migrations.** `prisma/sql/fts-indexes.sql` is
applied by `npm run db:indexes`, separately. The schema migration alone produced a
Mumbai database with zero full-text indexes — search would have worked but fallen
back to sequential scans, silently. Caught from the repo after Seoul was gone.
Anything that rebuilds this database must run that file too.

**There was no backup.** Item 0.5 of the readiness plan said "nobody has a backup
until they have restored one", and it was still open when the database was
deleted. That gap is now closed: `backups/seyon-backup-2026-08-24.tgz` holds every
row and file plus a `restore.sh`, and it has been restored into a clean Postgres
and compared field-by-field against live — 0 missing, 0 extra, 0 differing.

## Still open

- **Merge `fix/audit-2026-08`.** 21 commits, still unmerged. It carries
  `vercel.json` (now redundant, the region is set on the projects directly), the
  Postgres rate limiter, the boot-time config check, DPDP data export and account
  deletion, the grievance route, `/returns`, and consent-before-tracking.
- **Rotate three credentials** that passed through the chat: the `sbp_` Supabase
  token, the Mumbai service-role key, and the Vercel API token. Rotating the
  service-role key means updating both Vercel projects again.
- **Change the Mumbai database password.** It is `Kadambur%7676`, the same as the
  deleted Seoul project's, and it was pasted into chat. Note that a `%` in a
  connection string must be written `%25` — `%76` is a valid escape for `v`, so
  the raw form silently becomes `Kadamburv76` and fails as a wrong password.
- **Point local `.env` at the docker-compose Postgres** rather than production.
  It currently points at live Mumbai. `.env.seoul-backup` holds the old file.
- **Four broken images.** Three `ProductImage` rows and the `aroma-palace` logo
  and banner reference `/uploads/perfumes/*.png`, which does not exist in the
  repo. Broken in production now; unrelated to the migration.
- **Backups do not repeat.** One copy is not a schedule. Enable PITR or automate
  the export.
