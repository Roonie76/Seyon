# Seyon — readiness scorecard after two fix passes

**Branch:** `fix/audit-2026-08` · 16 commits · 69 files · +4,278 / −674

| | Original | After blockers | Now |
|---|---|---|---|
| Functional correctness | 6.0 | 8.0 | **9.0** |
| Data integrity | 7.0 | 8.0 | **9.5** |
| Realtime reliability | 6.0 | 6.0 | **9.0** |
| Error handling | 3.0 | 8.0 | **9.0** |
| Security | 6.0 | 8.0 | **9.0** |
| **Overall** | **5.5** | **7.5** | **9.1** |

**What this number covers, and what it does not.** These five dimensions are code and schema quality — the things I can change and verify from inside the repository. They are not the same as *launch* readiness. Four items from `LAUNCH-READINESS.md` sit outside them and still block a real launch, because none of them is code: an Upstash account so rate limiting actually works across instances, a real PostHog key, the database region move to Mumbai, and the Indian e-commerce disclosures. The scorecard would be dishonest if it implied those were done.

---

## Evidence

```
typecheck              clean
lint                   0 errors, 44 warnings      (was 8 errors)
unit tests             101 passed
regression tests        22 passed                 (written red, now green)
integration tests       36 passed  ← new, real Postgres
browser regression       8 passed, 1 skipped
production build       passes
migrations from empty  0 errors, 13 tables
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

**Why not 10:** the review gate is harder to forge but still soft — verifying contact server-side is the real fix. And rate limiting is only as good as its backing store: without Upstash configured it falls back to per-instance memory, which on Vercel means the limits are effectively per warm instance. That is an environment variable, not code, which is why it sits in Tier 0 of the launch plan rather than here.

---

## The part that makes these numbers mean something

Of the pre-existing 100 tests, **not one exercised a server action, a database mutation, or a rendered page** — every one covered a pure helper. That is precisely why 100 passing tests caught none of the 34 findings.

There are now 36 integration tests against a real Postgres, covering the things only a real database can demonstrate: that a stale `updatedAt` matches zero rows and two concurrent guarded writes produce exactly one winner; that cascades leave no orphans and analytics history survives a product delete; that the cached rating always equals the reviews it summarises; that an image surviving an edit keeps its id; that paused, suspended, DRAFT and ARCHIVED never reach a buyer query; and that every new constraint actually rejects the row it is meant to.

```bash
npm test                  # 101 unit
npm run test:regression   #  22 — one per confirmed finding
npm run test:integration  #  36 — real Postgres
npx playwright test tests/e2e/audit-regression.spec.ts
```

---

## Still open, deliberately

| Item | Why it is still here |
|---|---|
| F-15 HTTP status on `/store/*` | Cause not isolated after three ruled-out hypotheses; SEO consequence mitigated with `noindex` |
| No `Order` model | Product decision, not a defect — see the readiness plan |
| `discountPercent` | Dead column; delete it or use it |
| Duplicate suggestion endpoints | Two shapes, one rate-limit budget |
| Analytics day buckets | Server-local time, so an IST seller's chart is shifted 5½ hours |
| `DevNoticeModal` | Correct for a public preview; remove at launch |
| "Bestsellers you love" | Section heading over what is actually the newest eight products |
