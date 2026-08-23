# Migrations

Before this directory existed the schema was managed with `prisma db push`:
no history, no way to reproduce the schema on a fresh database, no rollback,
and `db push` silently drops columns it believes are unused.

`00000000000000_init` is a **baseline** — it describes the schema as it already
existed, generated with `prisma migrate diff --from-empty`. It has never been
run against production and must not be.

## One-time setup, per existing environment

Tell Prisma the baseline is already applied, then never touch `db push` again:

```bash
# against each existing database (production, staging)
npx prisma migrate resolve --applied 00000000000000_init

# then apply the constraints migration normally
npx prisma migrate deploy
```

A brand-new database needs no resolve step — `prisma migrate deploy` builds it
from scratch.

## From here on

```bash
npx prisma migrate dev --name what_changed   # authoring, locally
npx prisma migrate deploy                    # CI / deploy step
```

`00000000000001_integrity_constraints` adds CHECK constraints and a partial
unique index that were previously enforced only by application code. It
includes a data-repair step: products carrying more than one primary image are
reduced to one before the unique index is created, because live data violated
that rule.
