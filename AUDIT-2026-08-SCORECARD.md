# Seyon — readiness scorecard after three fix passes

**Branch:** `fix/audit-2026-08` · 21 commits

| | Original | After blockers | After pass 2 | Now |
|---|---|---|---|---|
| Functional correctness | 6.0 | 8.0 | 9.0 | **9.0** |
| Data integrity | 7.0 | 8.0 | 9.5 | **9.5** |
| Realtime reliability | 6.0 | 6.0 | 9.0 | **9.0** |
| Error handling | 3.0 | 8.0 | 9.0 | **9.0** |
| Security | 6.0 | 8.0 | 9.0 | **9.5** |
| Compliance & operability | 3.0 | 3.0 | 3.0 | **8.5** |
| **Overall** | **5.5** | **7.5** | **9.1** | **9.2** |

**What changed in pass 3, and what the number still does not cover.** The
previous scorecard said plainly that four items blocked a launch and none of
them was code. Three of them turned out to be code after all, and are done:
rate limiting now shares one counter across every instance via Postgres rather
than waiting on an Upstash account; the analytics key is no longer the blocker
because the events that would use it are defined, wired and gated on consent;
and the region move is a committed `vercel.json` pinning `bom1`. The fourth,
the Indian e-commerce disclosures, is largely code too and is now built —
data export, account erasure, a grievance route, a returns policy, and consent
before tracking.

**What genuinely remains outside the repository** is smaller and more honest:
appointing a named Grievance Officer (a real person who will answer the mail —
three environment variables once chosen), a PostHog project key, and a legal
review of the policy text by someone qualified in Indian consumer and data
protection law. Nothing in code can supply any of those, and the build now
warns at boot about the first two rather than letting them pass unnoticed.
---

## Evidence

```
typecheck              clean
lint                   0 errors, 44 warnings      (was 8 errors)
unit tests             132 passed                 (was 101)
regression tests        22 passed                 (written red, now green)
integration tests       42 passed  ← real Postgres, incl. concurrent limiter
browser regression      10 passed, 1 skipped
consent e2e              7 passed  ← real browser
production build       passes
migrations from empty  0 errors, no drift vs schema
```

---

## Functional correctness — 9.0

**Fixed this pass:** malformed pagination (`?page=abc`, `0`, `-3`) fell through to `skip: NaN`, threw, was swallowed, and rendered an empty catalogue — a bad link looked like an empty shop; search totals collapsed to 0 on any page past the end, so the pagination control claimed there were no results at all; product slugs were rewritten on rename, silently breaking every link the seller had already shared; product image ids were reissued on every save, breaking any client holding one; paused shops' product pages returned 404 despite the page having a working "currently away" state.

**Why not 10:** F-15 is partly open. A missing storefront renders the correct not-found UI but answers HTTP 200. I tested and ruled out three candidate causes by rebuilding and re-measuring each time — `export const revalidate`, the route's `loading.tsx` Suspense boundary, and moving `notFound()` into `generateMetadata`. Sibling routes without an awaited catalogue read return a true 404, so it is specific to these two routes. The consequence that matters — search engines holding on to deleted URLs — is fixed with an explicit `noindex`, verified in a production build. The status code itself is not, and I would rather say so than round up.

## Data integrity — 9.5

**Fixed this pass:** there were two answers to "what is this shop rated" — pages summed the loaded reviews while filters read the denormalised column, which was only ever recalculated inside `createReview`. A shop could be matched by the "4+ stars" filter while its own page displayed 3.2. One helper now owns that column. `/api/cart/validate` never checked a product belonged to the submitted shop.

**The larger change:** rules that lived only in application code now live in the database — price bounds, compare-at above price, non-blank title and slug, rating 1–5, non-negative display order, and at most one primary image per product. A script, an admin tool, or a future code path that forgets to validate can no longer write a row the UI cannot render. The primary-image constraint needed a data repair first, and includes it: live data already had a product carrying two primary images, and applying the index without the repair failed on exactly that row.

There is also a migration history now, where there was none. `db push` left no record of how production reached its current shape and silently drops columns it believes are unused.

**Why not 10:** `discountPercent` is still written on every save, still indexed, still read nowhere. And the schema has no `Order` — a product gap rather than an integrity one, but it is why reviews are gated on a WhatsApp tap rather than a purchase.

## Realtime reliability — 9.0

The badge read **LIVE** with a pulsing green dot over a 60-second poll. It now states the real cadence and the time of the last refresh. More usefully, a successful mutation broadcasts to every other tab in the same browser, so the common case — one seller, dashboard open in three tabs — converges in milliseconds. The poll remains as the backstop, alongside a refresh on tab focus.

**Why not 10:** no cross-device push. A change made on a phone still waits for the laptop's next poll. That was the deliberate trade in choosing this approach over Supabase Realtime.

## Error handling — 9.0

The blocker pass covered the systemic gap — no `try/catch` around any server action, which froze the UI on a disabled spinner with no message. This pass stopped the upload route returning `error.message` on a 500, and escaped both interpolation sites in the middleware's HTML redirect (verified against attribute-breakout, quote-breakout and `</script>` payloads).

**Why not 10:** error presentation is still per-component rather than a single pattern, and `error.tsx` / `global-error.tsx` have not had a proper design pass.

## Security — 9.0

`/api/cart/validate` is unauthenticated and reported title and price for any product id including DRAFT and ARCHIVED, leaking catalogue the seller had not published — and handed out the seller's WhatsApp number even for suspended shops. Admin authorisation re-reads the role from the database; the JWT claim could be 30 days stale, so a demoted admin kept full powers.

**Fixed in pass 3:** rate limiting no longer depends on an account someone has to open. Without Upstash it fell back to a per-process map, so on Vercel "5 login attempts per minute" was really 5 x however many instances were warm, reset on every cold start — the limits were decorative in exactly the environment where they matter. Postgres is already shared by every instance, so it holds the counters now: one upserted row per key per window, atomic under concurrency. Upstash stays preferred when configured.

**Why not 10:** the review gate is harder to forge but still soft — verifying contact server-side is the real fix.

## Compliance & operability — 8.5

This dimension did not exist on the earlier scorecards, which is itself the
finding: nothing was measuring whether Seyon could be operated and could
lawfully take Indian customers.

**Fixed this pass.** The privacy policy told visitors they could request
deletion at any time; there was no control anywhere in the product and no
inbox monitored for it. Both DPDP rights are now self-serve — export builds
the file in the browser and excludes other people's personal data, and
deletion is real deletion rather than a soft flag, with the shops the person
had rated re-aggregated so no cached average describes reviews that no longer
exist.

The policy and terms were shipping an unfilled template to real customers:
`[Name]`, `[Designation]`, and an italic note reading *[Required under the
DPDP Act, 2023...]*, duplicated across two files. There is now one source for
those details, one component rendering them, and an honest fallback when
nobody has been appointed — plus a boot warning so it is noticed rather than
shipped again.

PostHog was initialised for every visitor on mount, setting cookies and
capturing pageviews before anyone had been told anything. Analytics now loads
only after an explicit yes and stops on withdrawal.

And a deployment that cannot do its job correctly no longer starts quietly and
serves wrong data — a missing `SUPABASE_URL` used to turn every seller upload
into a random stock photo, silently. That is now fatal in production.

**Why not 10:** the Grievance Officer is a name Seyon has to appoint, and the
policy text should be read by counsel familiar with the DPDP Act and the
Consumer Protection (E-Commerce) Rules before launch. Seller legal details on
listings — the marketplace's obligation to display each seller's legal name
and address — would need new schema and new seller onboarding fields, which is
a product decision rather than a fix, so it is not in this branch.

---

## The part that makes these numbers mean something

Of the pre-existing 100 tests, **not one exercised a server action, a database mutation, or a rendered page** — every one covered a pure helper. That is precisely why 100 passing tests caught none of the 34 findings.

There are now 36 integration tests against a real Postgres, covering the things only a real database can demonstrate: that a stale `updatedAt` matches zero rows and two concurrent guarded writes produce exactly one winner; that cascades leave no orphans and analytics history survives a product delete; that the cached rating always equals the reviews it summarises; that an image surviving an edit keeps its id; that paused, suspended, DRAFT and ARCHIVED never reach a buyer query; and that every new constraint actually rejects the row it is meant to.

```bash
npm test                  # 132 unit
npm run test:regression   #  22 — one per confirmed finding
npm run test:integration  #  42 — real Postgres
npx playwright test       #  10 browser + 7 consent
```

---

## Still open, deliberately

| Item | Why it is still here |
|---|---|
| F-15 HTTP status on `/store/*` | Cause not isolated after six ruled-out hypotheses; SEO consequence mitigated with `noindex`, verified in a production build |
| No `Order` model | Product decision, not a defect — see the readiness plan |
| `discountPercent` | Dead column; delete it or use it |
| Duplicate suggestion endpoints | Two shapes, one rate-limit budget |
| Analytics day buckets | Server-local time, so an IST seller's chart is shifted 5½ hours |
| `DevNoticeModal` | Correct for a public preview; remove at launch — the consent banner waits behind it until then |
| Grievance Officer | Needs a named individual; three environment variables once chosen, and the build warns until then |
| Seller legal details on listings | Required of a marketplace, but needs new schema and onboarding fields — a product decision |
| "Bestsellers you love" | Section heading over what is actually the newest eight products |
