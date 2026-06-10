# Seyon — Execution Plan

Goal: bring Seyon to S-class production quality while staying simple. No payments — the chat-to-buy (DM) loop is the product. Every item below either hardens the platform or strengthens that loop.

Phases are ordered by dependency and impact. Each phase is independently shippable.

---

## Phase 0 — Stop-the-bleed hardening (1–2 days)

Small, urgent, no schema changes.

| # | Task | Detail |
|---|------|--------|
| 0.1 | Delete `src/app/api/debug-env/` folder | Dead remnant of an env-dumping endpoint. Remove from repo and history if public. |
| 0.2 | Security headers | Add `headers()` in `next.config.ts`: CSP (allow self, Supabase, PostHog, Unsplash), `X-Frame-Options: DENY`, `Strict-Transport-Security`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`. |
| 0.3 | Error & loading UX | Add `global-error.tsx`, root `error.tsx`, `not-found.tsx`; `loading.tsx` skeletons for `/marketplace`, `/store/[shopSlug]`, `/dashboard`. |
| 0.4 | Fix middleware host detection | Replace `host.includes('sell')` string matching with explicit env-configured domains (`SELLER_HOSTS` comma list). Add unit tests for edge hosts. |
| 0.5 | `metadataBase` fallback | Fail loudly (or use a `NEXT_PUBLIC_SITE_URL`) instead of silently falling back to `localhost` in layout, robots, sitemap. |

**Done when:** securityheaders.com scores A; killing the DB shows a branded error page, not a crash.

---

## Phase 1 — Database & performance foundation (2–3 days)

Schema work first, since Phases 2–3 build on it.

### 1.1 Prisma indexes
```prisma
model Product {
  @@index([status, category])
  @@index([shopId, status])
  @@index([createdAt])
}
model Shop    { @@index([isSuspended]) }
model Review  { @@index([shopId, createdAt]) }
model Analytics { @@index([shopId, eventType, createdAt]) }
```

### 1.2 Real full-text search
Replace `contains` queries with Postgres `tsvector`:
- Add generated `searchVector` column on Product (title + description) via raw migration.
- GIN index, query with `to_tsquery` through `$queryRaw` (typed + parameterized).
- Fallback to trigram (`pg_trgm`) for fuzzy matching if needed.

### 1.3 Bound the unbounded
- Sitemap: paginate with sitemap index files (`generateSitemaps`) once > 5k URLs; add `take` caps now.
- Marketplace and admin queries: cursor pagination everywhere (`take`/`cursor`), never bare `findMany`.

### 1.4 Rate limiting
- Single utility (`src/backend/lib/rate-limit.ts`) using Upstash Redis (or in-memory LRU fallback for dev).
- Apply to: credentials login, `/api/upload`, review submission, report submission, shop/product creation.
- Limits: login 5/min/IP, upload 20/hr/user, reviews 3/day/user/shop, reports 5/day/user.

**Done when:** search uses the GIN index (verify with `EXPLAIN`); spamming reviews returns 429.

---

## Phase 2 — Core feature gaps: the chat-to-buy loop (1–1.5 weeks)

The three highest-leverage features plus their supporting schema. One migration covers all of them.

### 2.1 Schema additions
```prisma
model Product {
  inStock        Boolean  @default(true)
  compareAtPrice Float?           // display-only "sale" pricing
  options        String?          // free-text variants: "Sizes: S/M/L · Colors: Red, Black"
}
model Shop {
  city           String?
  region         String?
  deliveryNote   String?          // "Ships across India" / "Pickup only, Chennai"
  isPaused       Boolean  @default(false)   // vacation mode
  whatsappVerifiedAt DateTime?
}
```

### 2.2 Stock / availability (S)
- Toggle in seller product table (optimistic UI, server action).
- "Sold out" badge on cards + product page; WhatsApp CTA disabled or swapped for "Ask when back in stock" prefill.
- Out-of-stock products stay visible (SEO) but sort last in marketplace.

### 2.3 Product options → smarter DM prefill (S)
- Optional `options` field in product form.
- Product page renders options as chips; selected chips are injected into the prefilled WhatsApp message:
  `"Hi! I want to order: {title} ({selectedOptions}) — {productUrl}"`.
- No variant inventory tracking — display + message only. Keep it simple.

### 2.4 WhatsApp number verification (M)
- One-time OTP: server generates 6-digit code, seller receives it via WhatsApp (Meta Cloud API free tier or a `wa.me` self-send fallback flow), enters it in dashboard.
- Sets `whatsappVerifiedAt`; feeds the existing TrustScore; "Verified WhatsApp" badge on storefront.
- Re-verify on number change.

### 2.5 Vacation mode (S)
- Dashboard toggle → `isPaused`. Storefront shows "Currently away — back soon" banner; CTAs disabled; products excluded from marketplace (not sitemap).

### 2.6 Seller location & delivery info (S)
- Onboarding + settings fields; shown on store header and product page near CTA.
- Marketplace filter by city/region (uses the new index).

### 2.7 Share & QR (S)
- Share button (Web Share API, clipboard fallback) on products and stores; WhatsApp-share deep link.
- Dashboard "Promote" card: auto-generated QR code (client-side `qrcode` lib, no service dependency) + copyable short store link for Instagram bio.

### 2.8 Marketplace filters & sorting (M)
- Price range, category (exists), city/region, in-stock only.
- Sort: newest, price asc/desc, rating. All as URL search params (shareable, SEO-crawlable).

**Done when:** a buyer can land on a product, see availability + delivery area + options, and the first DM contains everything the seller needs.

---

## Phase 3 — SEO optimization (3–4 days, parallel with Phase 2)

Existing: robots, sitemap, JSON-LD + `generateMetadata` on store/product pages. Gaps below.

### 3.1 Metadata coverage
- `generateMetadata` for `/marketplace` (incl. filtered/category states) and `/category/[slug]` — unique titles/descriptions per category.
- OpenGraph + Twitter card defaults in root layout; per-page OG using product/shop images.
- Dynamic OG images via `next/og` (`opengraph-image.tsx`) for products and stores — product photo + price + shop name. Big CTR win on WhatsApp/Instagram shares (which is exactly how this site spreads).

### 3.2 Structured data
- Extend Product JSON-LD with `offers.availability` (`InStock`/`OutOfStock` from 2.2), `priceCurrency`, `aggregateRating` from reviews.
- `LocalBusiness` JSON-LD on store pages using new city/region.
- `BreadcrumbList` on category → store → product chains.
- `ItemList` JSON-LD on marketplace/category pages.

### 3.3 Crawlability
- Add `/category/*` and paginated marketplace pages to sitemap; exclude paused shops.
- Canonical URLs on all filtered marketplace states (filters → canonical to base category).
- `rel=prev/next`-style internal linking + "Related products" block (same category/shop) on product pages for internal link equity.

### 3.4 Performance = SEO
- Target Core Web Vitals: LCP < 2.5s on product pages (priority `next/image` on hero, correct `sizes`), CLS ≈ 0 (fixed image aspect ratios — already using next/image, audit `sizes` props).
- ISR everywhere public: `revalidate` tuned (marketplace 60s, store 300s, product 300s) + `revalidateTag` on product/shop mutation so edits appear instantly.
- Run Lighthouse CI in the new pipeline (Phase 4) with budget: ≥ 90 performance, ≥ 95 SEO.

**Done when:** Rich-results test passes for Product + LocalBusiness; shared product links unfurl with image+price; Lighthouse SEO ≥ 95.

---

## Phase 4 — Quality, trust & ops (1 week)

### 4.1 CI/CD
- GitHub Actions: lint → typecheck → vitest → build on every PR; Lighthouse CI on preview deploys.
- Husky pre-commit: lint-staged + typecheck.

### 4.2 E2E tests (Playwright)
Critical paths only: seller onboarding → create product → toggles stock; buyer search → filter → product → WhatsApp CTA href correctness; review submit; admin suspend flow.

### 4.3 Observability
- Sentry (client + server) with source maps; alert on error-rate spikes.
- Structured logger (pino) replacing `console.error` in actions/API.
- `/api/health` endpoint (DB ping) for uptime monitoring.

### 4.4 Review integrity (M)
- Gate reviews: only users who clicked "Chat to Buy" on that shop (existing Analytics events) within last 90 days may review.
- One review per user per shop (enforce with unique constraint), editable.

### 4.5 Notifications (M)
- Transactional email via Resend: new review received, report status change, shop suspension/reinstatement, WhatsApp verification code fallback.
- Single `notify()` utility; templates in-repo. No marketing email machinery.

### 4.6 Accessibility pass
- Audit `ui/` primitives (dialog, tabs) — add ARIA roles, focus traps, keyboard nav, `Escape` handling.
- Visible focus rings; check glassmorphism contrast against WCAG AA (4.5:1).
- Add `eslint-plugin-jsx-a11y` to CI.

**Done when:** CI blocks bad merges; Sentry catches a forced test error; keyboard-only navigation works end to end.

---

## Phase 5 — Seller growth & retention (1 week, post-launch)

| # | Feature | Notes |
|---|---------|-------|
| 5.1 | Per-product click analytics | Surface existing event data: "23 people tapped Buy this week" on the product table + simple trend in dashboard. Retention driver. |
| 5.2 | Quick-add / bulk product entry | Multi-image drop → one product per image with title/price inline-editable. Biggest onboarding friction fix. |
| 5.3 | Sale display | UI for `compareAtPrice` (2.1): strikethrough + "% off" badge; `priceValidUntil` in JSON-LD. |
| 5.4 | Empty states & onboarding checklist | Dashboard checklist: add logo → verify WhatsApp → add 3 products → share QR. Progress bar. |

---

## Explicitly out of scope (keep it simple)

Payments/checkout, order management, in-app chat, buyer accounts beyond wishlist/reviews, follower systems, coupon engines, native apps, i18n (revisit after traction — likely the first thing to add back if targeting non-English sellers).

---

## Sequencing summary

```
Week 1   Phase 0 + Phase 1          (hardening, DB, search, rate limits)
Week 2-3 Phase 2 ∥ Phase 3          (chat-to-buy features ∥ SEO)
Week 4   Phase 4                    (CI, e2e, observability, a11y, reviews, email)
Week 5   Phase 5                    (growth features)
```

Single combined Prisma migration at start of Phase 2. Phases 2 and 3 can run in parallel since SEO work mostly touches metadata/JSON-LD files, not actions.

## Success metrics

- Lighthouse: Perf ≥ 90, SEO ≥ 95, A11y ≥ 95 on product pages.
- securityheaders.com grade A; zero unhandled-error blank screens.
- Search p95 < 100ms at 50k products (GIN index).
- % of DMs initiated with prefilled options (PostHog) — proxy for loop quality.
- Seller activation: % of new shops reaching verified WhatsApp + 3 products in 7 days.
