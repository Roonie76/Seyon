# Seyon — Future Features Backlog

Vision anchor: connect Instagram / WhatsApp / Telegram sellers to buyers. Sellers operate from reels and DM-price chaos; Seyon gives each one a promotable storefront with an organised, priced catalog, plus a shared marketplace for discovery. No payments, no logistics — chat-to-buy is the product.

Priority key: P1 = build next · P2 = soon · P3 = someday · ❌ = considered and rejected.

---

## P1 — Build next

### 1. Reel-to-Catalog (flagship)
Sellers' reels showcase ~30 products in 30 seconds with "DM to buy". Let the seller upload that same reel file into the dashboard:
- Video player with a **Capture** button — scrub, tap on each product frame.
- Each captured frame → draft product via the existing Quick Add pipeline (`quickAddProducts`).
- Pure client-side: `<video>` + `<canvas>` frame grab → existing `/api/upload` → drafts.
- No Meta API, no business account, no permissions. The reel that says "DM for price" becomes a browsable priced catalog in ~2 minutes.

### 2. Mobile bottom navigation (buyer site)
Buyers arrive from IG/WhatsApp links — nearly 100% mobile, often inside the Instagram in-app browser — and currently dead-end on storefronts (desktop nav is `hidden md:flex`, no hamburger).
- Bottom bar: Home | Categories | Search | Wishlist. Max 5 items, icon + label, active-tab highlight.
- Every storefront visit should leak into marketplace discovery — this is the network effect.

### 3. Header search bar (buyer site)
Search lives only on the marketplace hero. Put a full visible input in the header on every page ("search users convert 3–5×" — Baymard). Buyer lands on one store, searches, discovers ten.

---

## P2 — Soon

### 4. "Share my catalog" WhatsApp blast
One tap in the dashboard → prefilled broadcast message: top 3 products + prices + store link. Seller pastes into WhatsApp status / groups. Distribution tool, near-zero build cost.

### 5. Buyer "my enquiries" list
localStorage list of products the buyer tapped *Chat to Buy* on, so they can find their way back to that saree from 3 days ago. No login needed. (Recently-viewed strip already exists; this is the higher-intent variant.)

### 6. Accessibility round 2 (from benchmark audit)
- Touch targets to 44px (navbar logout, wishlist heart, table action buttons are ~32px).
- Skip-to-content link.
- Contrast audit: amber-600 on white likely under 4.5:1 in places.

### 7. Search autocomplete
Suggestions after 2 characters with product thumbnails; "popular searches" empty state. Backend exists (FTS); needs a typeahead endpoint + dropdown component.

### 8. Account dropdown in navbar
Avatar → dropdown (Profile / Wishlist / Dashboard / Sign Out last). Replaces the bare logout icon. Lower priority because most buyers never log in — ordering requires no account by design.

### 9. E2E coverage expansion
Current: smoke + buyer journey + auth (~9 specs). Add: seller onboarding flow, product create/edit, vacation mode toggle, admin suspend, quick-add.

### 10. Lighthouse CI thresholds
`lighthouserc.cjs` exists; wire `lhci autorun` into the GitHub Actions pipeline with budgets (perf ≥ 90, SEO ≥ 95) once a stable preview URL exists.

---

## P3 — Someday

- **Custom domains / subdomains per store** (`storename.seyon.in`) — the ultimate "individual website" promise.
- **Product image zoom / pinch-to-zoom** in the gallery; swipe gestures.
- **Review photos** — buyers attach an image to reviews (purchase-confidence boost).
- **Newsletter capture** near footer ("new products from sellers you follow").
- **Follow a shop** + notification on new products — revisit only after real traction.
- **i18n** — Hindi/Tamil etc. for seller dashboard first (sellers are the non-English-first audience).
- **Upstash Redis rate limiting** — swap the in-memory limiter for exact global limits (function signature already compatible).
- **Per-store benefit bar** — seller-configurable strip on their storefront ("Free delivery in Chennai over ₹500").
- **Rating sort in marketplace** — needs denormalised rating column or computed sort.

---

## Pending configuration (code shipped, needs keys)

| Feature | Env vars |
|---|---|
| WhatsApp OTP live delivery | `WHATSAPP_CLOUD_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TEMPLATE_NAME` |
| Email notifications | `RESEND_API_KEY`, `NOTIFY_FROM_EMAIL` |
| Sentry releases + source maps | `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` |

---

## ❌ Rejected

- **Instagram Graph API import** (pull posts/reels as products) — rejected. Sellers' reels bundle ~30 products per video with no per-product posts to import; Meta business-account requirement adds onboarding friction. Reel-to-Catalog (P1 #1) solves the same job with the seller's own video file and zero external dependencies.
- **Payments / checkout / order management** — permanently out of scope. The DM is the checkout.
- **In-app chat** — duplicates WhatsApp; bloat.
