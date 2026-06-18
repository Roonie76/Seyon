# Footer Expansion Plan — About, Contact, Address, FAQs, Categories, Blog

**Goal:** Add 6 items to the storefront footer: **About**, **Contact Us**, **Company Address**, **FAQs**, **Categories**, **Blog**.

**Grounded in the current codebase** (not generic):
- Footer component: `src/frontend/components/shared/footer.tsx` (single shared footer).
- It's rendered by `src/app/(shopper)/layout.tsx` (`<Footer />`), so every `(shopper)` route inherits it.
- Existing static pages to mirror: `src/app/(shopper)/terms/page.tsx`, `…/privacy/page.tsx` — server components using `Card`/`CardContent`, a lucide icon, the `glass` class, and a "Last updated" line.
- Category routing today: `src/app/(shopper)/category/[slug]/page.tsx` exists, **but there is no `category/page.tsx` index** — so `/category` currently 404s. It pulls data via Prisma (`@/lib/db`) and uses `@/lib/seo` JSON-LD helpers + `Breadcrumbs`.
- SEO infra already in use: per-page `generateMetadata`, `src/app/sitemap.ts`, JSON-LD helpers.
- **Not present in deps:** no email provider (Resend/Nodemailer/SendGrid) and no blog/CMS (MDX/Contentlayer/Sanity); no `Post`/`Faq`/`ContactMessage` Prisma models. These drive the decisions below.

---

## Routing decisions

All new reader-facing pages live in the **`(shopper)` route group** so they get the navbar + footer automatically and resolve as clean root paths:

| Item | Route | New file | Type |
|---|---|---|---|
| About | `/about` | `src/app/(shopper)/about/page.tsx` | Static server page |
| Contact Us | `/contact` | `src/app/(shopper)/contact/page.tsx` (+ form) | Page + Server Action/API |
| FAQs | `/faq` | `src/app/(shopper)/faq/page.tsx` | Static page (accordion) |
| Categories | `/category` | `src/app/(shopper)/category/page.tsx` | DB-backed index (fills the 404 gap) |
| Blog (list) | `/blog` | `src/app/(shopper)/blog/page.tsx` | Content-backed |
| Blog (post) | `/blog/[slug]` | `src/app/(shopper)/blog/[slug]/page.tsx` | Content-backed |
| Company Address | — | (no route) inline in footer + Contact page | Static text |

---

## Per-item plan

### 1. About → `/about`
- **Effort:** S. Lowest risk — pure static server component.
- Mirror `terms/page.tsx`: hero icon + `<h1>About Seyon</h1>`, then `Card`/`CardContent` sections (Mission, What we do, How it works — direct-to-seller WhatsApp ordering, Team/Story).
- Add `export const metadata` (title/description) + a breadcrumb. Add `/about` to `sitemap.ts`.

### 2. Contact Us → `/contact`
- **Effort:** M (depends on backend choice below).
- Page: contact details (email, social, **company address** block reused from item 3), business hours, plus a contact form (name, email, subject, message).
- **Form backend — pick one (recommend B for MVP, A→later):**
  - **A. `mailto:` only (zero backend):** form is a styled `mailto:` link/prefill. Fastest, but no record kept. Fine as a stopgap.
  - **B. Prisma `ContactMessage` model + Server Action (recommended):** add a `ContactMessage` model (`id, name, email, subject, body, createdAt, status`), a migration, and a Server Action that validates (zod) + writes to DB. Admins read them in `src/app/admin`. No new external dependency.
  - **C. Email via Resend:** add `resend` dep + `RESEND_API_KEY` env + an API route that sends to a support inbox. Best UX but adds a dependency + secret + deliverability setup.
- Add spam protection (honeypot field or rate-limit) regardless of option. Add `/contact` to `sitemap.ts`.

### 3. Company Address
- **Effort:** XS. Static content, no route.
- Add an address block to the footer (new "Company" column) and to the Contact page: legal entity name, street, city/state/PIN, country, support email, optional GSTIN.
- Source the values from one place — e.g. `src/lib/site-config.ts` (`SITE.address`, `SITE.supportEmail`) — so footer + contact + (future) invoices stay consistent. **Action item: you provide the real address/email**; I'll wire the constant.

### 4. FAQs → `/faq`
- **Effort:** S–M.
- Static Q&A grouped by topic (Ordering & WhatsApp checkout, Payments, Shipping/returns expectations, Seller onboarding, Account/login).
- UI: an accordion. Check for an existing shadcn `Accordion` (`src/components/ui/accordion.tsx`); if absent, add it (Radix `@radix-ui/react-accordion`) or render a simple `<details>`/`<summary>` list (no dep).
- Add `FAQPage` JSON-LD (rich-result eligible) via the existing `@/lib/seo` pattern. Add `/faq` to `sitemap.ts`.
- Content as a typed array `FAQ_ITEMS` in the page (or `src/content/faq.ts`) so it's easy to edit.

### 5. Categories → `/category`
- **Effort:** S–M. **Also fixes a real bug:** `/category` has no index page today.
- Create `src/app/(shopper)/category/page.tsx` mirroring `category/[slug]/page.tsx`: a grid of category cards linking to `/category/[slug]`, ideally with a product count per category from Prisma.
- Single source of truth for the category list: the names are currently **hardcoded in the footer** (`Fashion, Electronics, Beauty, Home & Living, Clay Crafts, DIY Crafts, Art & Collectibles, Food & Beverages`) and referenced in several other files (marketplace, sitemap, sell page). **Extract them into `src/lib/categories.ts`** and import everywhere (footer, this landing, marketplace filters, sitemap) to kill the duplication.
- Add `ItemList`/`BreadcrumbList` JSON-LD + metadata. Add `/category` to `sitemap.ts`.
- **Footer link note:** today the footer's category links point to `${BUYER_MARKET_URL}/category/...` (the separate buyer-market app). Decide whether the new "Categories" footer link should go to the **same-app** `/category` (recommended, consistent with `/privacy`,`/terms`) or the buyer-market. I recommend same-app relative links.

### 6. Blog → `/blog` and `/blog/[slug]`
- **Effort:** L. The biggest item; needs a content source (none exists yet). **Pick one:**
  - **A. MDX files (recommended for a content/SEO blog):** add `@next/mdx` (or `next-mdx-remote` + `gray-matter`), store posts in `src/content/blog/*.mdx` with frontmatter (title, date, excerpt, cover, author, tags). `/blog` reads the folder and lists posts; `/blog/[slug]` renders MDX. Git-versioned, no DB, great SEO. Adds 1–2 deps.
  - **B. Prisma `Post` model + admin (recommended if non-devs will publish):** add `Post` model (`id, slug, title, excerpt, body, coverUrl, status, publishedAt, authorId`), migration, an editor under `src/app/admin`, and list/detail pages reading from DB. More work, but content is managed in-app.
  - **C. Static array (MVP only):** a `BLOG_POSTS` array for 2–3 launch posts. Quickest, not scalable.
- Either way: `/blog` (paginated list of cards), `/blog/[slug]` (article with `Article`/`BlogPosting` JSON-LD), per-post `generateMetadata` (OpenGraph/Twitter), and **dynamic sitemap entries** (extend `sitemap.ts` to enumerate posts).

---

## Footer component changes (`src/frontend/components/shared/footer.tsx`)

Today it's: a "Shop by Category" row, then one flat link row (Home, Marketplace, Privacy, Terms) + logo/socials/copyright. Adding 5 link items + an address to a single row will crowd it. **Restructure into a 4-column grid** (stacks on mobile), then keep the existing logo/social/copyright bar:

- **Company:** About · Contact Us · Blog · *(address block underneath)*
- **Shop:** Marketplace · Categories · *(keep the existing per-category links here or collapse them)*
- **Support:** FAQs · Contact · Privacy Policy · Terms of Service
- **Connect:** social icons (existing) + support email

Implementation notes:
- Drive every column from arrays (`{ label, href }[]`) so it's data-driven and testable.
- Keep links **relative** for same-app routes (`/about`, `/contact`, `/faq`, `/blog`, `/category`); only category-slug links may stay on `BUYER_MARKET_URL` if you want them to hit the buyer market.
- Preserve current styling tokens (`bg-secondary`, `text-zinc-400`, `hover:text-white`, `glass`).
- Add `aria-label`s per nav group for a11y.

---

## Cross-cutting concerns

- **SEO:** every new page gets `generateMetadata` + canonical; extend `src/app/sitemap.ts` with `/about`, `/contact`, `/faq`, `/category`, `/blog`, and (dynamically) blog post URLs. Add JSON-LD where it earns rich results (FAQ → `FAQPage`, blog post → `BlogPosting`, category → `ItemList`).
- **Single source of truth:** new `src/lib/site-config.ts` (address, support email, socials) and `src/lib/categories.ts` (category list) — both consumed by the footer and the new pages.
- **Styling consistency:** reuse the `terms`/`privacy` page shell (glass card, amber accent, hero icon) so the new pages look native.
- **Accessibility:** labelled nav landmarks, focus-visible states, accordion keyboard support.
- **Analytics:** there's an `Analytics` Prisma model — optionally track footer link clicks / contact submits.

---

## Suggested build order (phased)

1. **Phase 1 — quick wins (static):** `site-config.ts` + `categories.ts`; About page; FAQ page; Company Address in footer; **footer restructured** with all links wired (Blog/Contact/Categories can point to placeholder routes first). Ship.
2. **Phase 2 — Categories index:** build `/category` landing (fixes the 404), extract category list usage.
3. **Phase 3 — Contact:** page + chosen backend (start with Prisma `ContactMessage` + Server Action; admin view).
4. **Phase 4 — Blog:** chosen content system (MDX recommended) + list/detail + sitemap + JSON-LD.

---

## Decisions I need from you before building
1. **Contact form backend:** mailto (A) / Prisma store (B, recommended) / Resend email (C)?
2. **Blog content system:** MDX files (A, recommended) / Prisma `Post` + admin (B) / static array (C, MVP)?
3. **Company address + support email** (real values).
4. **"Categories" footer link target:** same-app `/category` (recommended) or the buyer-market app?
5. **Effort appetite:** Phase 1 only now, or all four phases?

## Effort estimate
- About: ~0.5 day · FAQ: ~0.5–1 day · Company Address: ~1–2 hrs · Footer restructure: ~0.5 day · Categories index: ~0.5–1 day · Contact: ~1–1.5 days · Blog: ~2–4 days (depending on system). **Phase 1 ≈ 1–1.5 days; full set ≈ 5–8 days.**
