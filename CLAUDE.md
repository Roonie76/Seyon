@AGENTS.md

# Seyon — Repository Structure & Deployment

> **Read this before touching app code or Vercel settings.** This repo was consolidated
> from three near-identical copies into ONE. The notes below exist so it stays that way.

## Single source of truth

All application code lives in the **root `src/` directory** (Next.js App Router at `src/app`).
This one app serves **both** audiences:

- `src/app/(shopper)/` — the buyer marketplace (`/marketplace`, `/store`, `/about`, `/faqs`, `/contact`, `/blog`, `/category`, …)
- `src/app/(seller)/` — the seller portal (`/dashboard`, `/sell`, `/seller-account`)

Which experience a visitor sees is decided at runtime by **`src/middleware.ts`** based on the
request host, using the **`SELLER_HOSTS`** env var (comma-separated hostnames). Hosts listed in
`SELLER_HOSTS` get the seller experience; every other host gets the buyer experience.

**There is no separate "buyer app" and "seller app" anymore. Edit `src/` only.**

## Deployment topology (Vercel)

Two Vercel projects, **both building from the repo root**, **both pointing at the same database**
(verified identical `DATABASE_URL` + `SUPABASE_URL`):

| Project | Domain | Role | Root Directory |
|---|---|---|---|
| `seyon` | `seyon-pied.vercel.app` | Buyer marketplace | `./` (repo root) |
| `seyon-seller` | `seyon-seller.vercel.app` | Seller portal (host in `SELLER_HOSTS`) | `./` (repo root) |

> ⚠️ The `seyon` project's **Root Directory must be `./` (repo root)**, NOT `buyer-market`.
> If it ever points at `buyer-market`, the marketplace silently serves a stale copy and new
> routes (e.g. `/about`, `/faqs`) return 404 even though the build is green. This was the
> original bug that caused the consolidation.

Both projects deploy automatically on push to `main`. Same code, same DB → the two sites can
never drift.

## Deprecated — do NOT recreate

`buyer-market/` and `seller-portal/` were the **old design**: two separate apps with two
separate databases, kept in sync by a webhook (`seller-portal` → `POST /api/webhooks/product-sync`
on `buyer-market`). They have been **deleted**. Because both deployments now share one database,
that sync webhook is unnecessary.

**Never re-add `buyer-market/` or `seller-portal/`, and never copy components/routes into a
parallel folder.** If you find yourself editing the "other copy," stop — there is only one copy.
