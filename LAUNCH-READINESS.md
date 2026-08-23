# Seyon — what's left before real customers use it

**Companion to `AUDIT-2026-08.md`.** The audit covered defects. This covers everything else standing between the current branch and paying users: infrastructure, legal exposure, product gaps, and the operational habits that keep a marketplace alive after launch.

Everything below was checked against the actual repository and environment, not assumed. Where I'm inferring intent rather than reading it, I say so.

---

## Where things stand

The 13 launch-blocking defects are fixed on `fix/audit-2026-08` and verified against a running instance. That moves MVP readiness from **5.5/10 to roughly 7.5/10**.

The remaining 2.5 is not more bug-fixing. It is four things: **the database has no migration history**, **rate limiting doesn't actually work in production**, **you have no order records at all**, and **the site is missing disclosures Indian e-commerce rules require**. Those are the real gates.

---

## Tier 0 — Do not launch without these

### 0.1 There is no migration history

`prisma/migrations/` does not exist. The schema is managed with `prisma db push`, which means:

- no record of how the production schema got to its current shape
- no way to reproduce it on a fresh database, or verify staging matches production
- no rollback when a change goes wrong
- `db push` silently drops columns it thinks are unused

**Done.** Baselined as `00000000000000_init`, with `00000000000001_integrity_constraints` and `00000000000002_rate_limit_counter` on top. Verified: the three replay onto an empty database with no errors and `prisma migrate diff` reports no drift against the schema. What is left for you is the one-time `npx prisma migrate resolve --applied 00000000000000_init` against production, and switching the deploy step to `migrate deploy`.

The original instructions, for reference:

```bash
mkdir -p prisma/migrations/0_init
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql
npx prisma migrate resolve --applied 0_init   # against production, once
```
Then add `npx prisma migrate deploy` to the deploy step and stop running `db push` against anything shared. Half a day, and it is the single highest-leverage infrastructure change on this list.

### 0.2 Rate limiting is not actually running

`UPSTASH_REDIS_REST_URL` / `_TOKEN` are absent, so `rate-limit.ts` falls back to a per-process in-memory Map. On Vercel every serverless instance gets its own — so "5 login attempts per minute" is really 5 × however many instances are warm, and it resets on every cold start. The code already logs a security warning about this in production; nobody is reading it.

This got more load-bearing with the audit fixes: analytics dedupe and the public `trackEvent` guard both ride on the same limiter.

**Done in code, and Upstash is no longer required.** Waiting on an account to make the limits real was the wrong shape of fix — the database is already shared by every instance, so it now holds the counters: one upserted row per key per fixed window, atomic under concurrency. Memory is used only outside production. Upstash stays the preferred backend when configured, because it keeps this load off Postgres, and the boot check tells you it is missing rather than staying silent.

Verified with 6 integration tests against a real Postgres, including 10 concurrent callers on one key admitting exactly 4.

### 0.3 The database is in the wrong hemisphere

`DATABASE_URL` points at `aws-1-ap-northeast-2` — Seoul. For a marketplace aimed at Indian creators and buyers, every one of the several queries each page makes crosses roughly 150 ms of ocean, and every shopper route renders dynamically (see 2.1).

**Half done.** `vercel.json` now pins functions to `bom1` and is committed. The Supabase project move to `ap-south-1` is still yours — it needs a maintenance window, and it is the half that actually removes the 150 ms, so do not stop at the config file. Much cheaper now than after you have sellers.

### 0.4 Analytics are not being collected

`NEXT_PUBLIC_POSTHOG_KEY` is `mock-posthog...`; the client logs "PostHog Mock Initialized". You will launch blind — no funnel, no activation rate, no idea which step sellers abandon.

**Instrumented; the key is yours.** Eleven events are now defined and typed in one file so the same thing cannot be fired under three names — the seller funnel through to `product_published`, the buyer funnel through to `whatsapp_tapped`, and two friction events that tell you *why* the funnel leaks. They no-op safely when PostHog is not loaded, and they only fire after the visitor has consented.

What remains is a real project key. The boot check warns when it is missing, so a deploy without one is loud rather than silent.

### 0.5 Backups you have actually restored

Supabase takes daily backups on paid plans; free tier does not. Nobody has a backup until they have restored one.

**Do this:** confirm the plan includes PITR, then restore a snapshot into a scratch project and check row counts against production. Write down the steps. Two hours, once.

### 0.6 Legal disclosures for an Indian marketplace

I am not a lawyer and this is not legal advice — treat it as a checklist to take to one. But these are specific, cheap to add, and their absence is the kind of thing that ends a marketplace early.

| Requirement | Where it comes from | Status |
|---|---|---|
| Named grievance officer with contact and response timelines | Consumer Protection (E-Commerce) Rules 2020 | **Built, needs a name** — one source, one component, both legal pages, 48h/30d timelines stated; set `NEXT_PUBLIC_GRIEVANCE_NAME`/`_DESIGNATION`/`_EMAIL` and the boot warning goes away |
| Return, refund and cancellation policy | Same | **Done** — `/returns`, linked from both footers |
| Consent before non-essential tracking (PostHog, Sentry) | DPDP Act 2023 | **Done** — nothing loads until an explicit yes; reversible from the privacy policy |
| Working account deletion and data export | DPDP Act 2023 (data-principal rights) | **Done** — both self-serve on My Account |
| Seller's legal name, address and contact shown on the listing | Consumer Protection (E-Commerce) Rules 2020 | **Missing** — needs new schema and seller onboarding fields, so it is a product decision rather than a fix |
| Country of origin on goods | Legal Metrology / e-commerce rules | **Missing** — same shape: a new product field and a form change |
| Separate seller agreement, distinct from buyer Terms | Contractual hygiene | **Missing** |
| Clear statement that Seyon does not process payments or fulfil orders | Liability | **Improved** — `/returns` says it plainly and repeatedly, which is where a buyer looks when something has gone wrong |

Two caveats worth stating rather than burying. The policy text is written to
match what the product actually does, but it has not been read by anyone
qualified in Indian consumer and data protection law, and it should be before
launch. And the grievance officer has to be a person who will answer the mail;
code can make the details impossible to forget, not supply them.
The last one deserves emphasis. Seyon hands buyers to WhatsApp and never sees the transaction. That is a defensible model, but it must be stated plainly and repeatedly, because a buyer who gets scammed will come to you first.

### 0.7 Rotate the credentials that have been on a laptop

`.env` holds a live Supabase **service-role** key — full database access, bypassing row-level security — alongside Google OAuth secrets and a WhatsApp Cloud token. It is correctly gitignored and not in history (I checked). But it has been sitting on a development machine pointed at production.

**Do this:** rotate the service-role key, the Google client secret and the WhatsApp token; keep production values only in Vercel; point local `.env` at the docker-compose Postgres that already ships in this repo.

---

## Tier 1 — Within the first month

### 1.1 You have no orders

This is the biggest product gap and it is invisible because the WhatsApp handoff hides it. There is no `Order` model. Consequences that will hit within weeks:

- a seller cannot see what sold, so your dashboard's most valuable number does not exist
- reviews are gated on a WhatsApp *tap*, not a purchase — a soft gate that is trivially gamed
- no dispute trail when a buyer says they paid and a seller says they didn't
- no GMV, no take rate, no path to revenue
- no repeat-purchase signal, so no retention metric

You do not need payments to fix this. A lightweight `Order` record created at the moment of the WhatsApp handoff — buyer, seller, items, options, a status the seller can move through (`enquired → confirmed → shipped → delivered → cancelled`) — gives you order history, honest review gating, and a real funnel. Two to three weeks.

### 1.2 Inventory is a boolean

`inStock` is true/false; `cart/validate` literally says `availableQuantity: null // No numeric inventory in schema yet`. A seller with three of something will oversell it. Add a nullable quantity and decrement it when an order reaches `confirmed`.

### 1.3 Seller identity verification

WhatsApp verification is well built and it proves the number is reachable — it does not prove who the seller is. Before a shop is publicly listed, collect and check: legal name, address, a government ID or GSTIN. Gate the "Verified" badge on that, not on an admin toggle.

### 1.4 Finish the audit's P2 list

From `AUDIT-2026-08.md`, in order of value:

- **F-15 soft-404s** — `/store/*` returns HTTP 200 with not-found copy. Two lines: delete the inert `export const revalidate = 300` from both store routes. Search engines are currently indexing dead product URLs. The regression spec has two `test.fixme` cases waiting for this.
- **F-24 every route is dynamic** — `Navbar` calls `auth()` in the shopper layout, forcing per-request rendering everywhere and adding a `db.user.findUnique` to every page view. Move the auth-dependent part into a Suspense-isolated child and the static pages become static.
- **F-19b two sources of truth for ratings** — store and product pages compute the average live; marketplace filters and cards use the denormalised `Shop.averageRating`, which is only recalculated inside `createReview` and never after a cascade delete. Pick one.
- **F-21** — `/api/cart/validate` is unauthenticated and returns title, price and the seller's raw WhatsApp number for any product id, including DRAFT and ARCHIVED. Scope it to ACTIVE and stop returning the number before checkout.
- **F-22** — role is read from the JWT and never re-checked, so an admin demotion does nothing until the token expires. Re-read the role in `verifyAdminAuth`.
- **F-20 / F-23** — clamp pagination inputs (`?page=abc` currently renders an empty catalogue), and compute the search total with its own `COUNT(*)` so an out-of-range page still reports the real number.

### 1.5 Put the real tests in CI

CI runs lint, typecheck, unit tests, build and Lighthouse. It does not run the regression suite or any browser test — so nothing in CI would catch a returning audit bug. Add:

```yaml
- run: npm run test:regression
- run: npx playwright test          # against a preview deployment
```

And close the gap the audit named: of the 100 existing tests, **none** exercises a server action, a database mutation, or a rendered page. Every one covers a pure helper. A handful of integration tests against a throwaway Postgres would be worth more than another fifty unit tests.

### 1.6 Know when it breaks

Sentry is wired up. Confirm events actually arrive, then add:

- uptime checks on `/api/health` from an Indian region, alerting to your phone
- an alert on 5xx rate and on p95 latency
- a Slack or email destination for `logger.error` in production

You currently have no way to learn that the site is down other than someone telling you.

---

## Tier 2 — Before you scale past the first hundred sellers

**Cost control.** Every shopper page is a dynamic render with several queries; `getShopAnalytics` runs 14 sequential counts per dashboard load, and every open dashboard tab repeats that every 60 seconds. Collapse the analytics loop into one `groupBy` with `date_trunc`, and fix F-24. Both are hours, not days, and they change your Supabase and Vercel bills by a multiple.

**A staging environment.** Right now there is production and a laptop. One preview project with its own database, seeded from the (now-guarded) seed script, and Vercel preview deployments per PR.

**Abuse handling.** Reports and suspension exist. What is missing is a queue that gets looked at, an SLA, and a way for a buyer to report a seller who took money and vanished — the failure mode this model makes most likely.

**Trust content.** A short, honest "how Seyon works and what it does not do" page will prevent more disputes than any feature.

**Accessibility.** `eslint-plugin-jsx-a11y` is configured and Lighthouse CI runs. There are 8 pre-existing lint errors (`react-hooks/set-state-in-effect`, unescaped entities, one `any`) — none introduced by this branch, all worth clearing before they multiply.

**Performance basics.** `product-card`, the navbars and several blog components use `<img>` rather than `next/image`, so those are unoptimised. `getTrendingCategories` runs 7 sequential `contains` queries with no supporting index.

---

## What I did not change, and why

Scope for this pass was the 13 launch blockers, so these stayed as they are:

- The two-domain split (seller host / buyer host) and its `htmlRedirect` middleware. It works; changing it is architecture, not repair.
- `discountPercent` — written on every save, carries a dedicated index, read nowhere. Harmless, but delete it or use it.
- The duplicate suggestion endpoints (`/api/search-suggestions` and `/api/search/suggestions`) — different shapes, same rate-limit budget.
- The `DevNoticeModal`. Correct for a public preview; remember to remove it at launch.
- `"Bestsellers you love"` as a section heading over what is actually the newest eight products. Section-level marketing copy rather than a per-product claim, so it did not meet the bar for the fabricated-social-proof fix — but it is still a claim you cannot support.
- Analytics day buckets use server-local time (UTC on Vercel), so an IST seller's chart is shifted 5½ hours and the last bar is always partial.

---

## Suggested order

| When | What | Rough effort |
|---|---|---|
| **This week** | Merge `fix/audit-2026-08`. Then: `migrate resolve --applied` against production (0.1), appoint the grievance officer (0.6), PostHog key (0.4), rotate secrets (0.7). Upstash is no longer needed. | 1 day |
| **Next week** | Supabase project move to `ap-south-1` (0.3), backup restore test (0.5), legal review of the policy text (0.6), monitoring (1.6). | 2–3 days |
| **Weeks 3–5** | Order records (1.1), inventory quantity (1.2), P2 fixes (1.4), CI additions (1.5). | 2–3 weeks |
| **Before scale** | Seller verification (1.3), cost fixes, staging, abuse SLA. | ongoing |

**Soft launch after the "this week" and "next week" rows.** A limited cohort — twenty sellers you can call — will teach you more than another month of hardening, and by then nothing on the list can lose their data or misrepresent them to buyers.
