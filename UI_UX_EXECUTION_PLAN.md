# UI/UX Execution Plan

Grounded in a full read of the shopper-facing pages and shared components.
Each fix lists the exact file, the lines affected, the current code, and the replacement.

All changes must be synced to `seller-portal/src/` and `buyer-market/src/` if the file
exists there (same copy-paste rule as the previous audit).

---

## Phase 1 — Quick wins (≤ 5 min each, no logic change)

### Fix 1 · Add `group` class to product card `<Link>` wrappers

**Problem:** `group-hover:text-amber-600` is on the title `<h3>` in every product card,
but the parent `<Link>` is missing `class="group"`. The hover colour never fires.

**Files & lines:**

#### `src/app/(shopper)/marketplace/page.tsx` — line 303
```diff
- <Link key={prod.id} href={`/store/${prod.shop.slug}/${prod.slug}`}>
+ <Link key={prod.id} href={`/store/${prod.shop.slug}/${prod.slug}`} className="group">
```

#### `src/app/(shopper)/store/[shopSlug]/page.tsx` — line 232
```diff
- <Link key={prod.id} href={`/store/${shop.slug}/${prod.slug}`}>
+ <Link key={prod.id} href={`/store/${shop.slug}/${prod.slug}`} className="group">
```

#### `src/app/(shopper)/store/[shopSlug]/[productSlug]/page.tsx` — line 343 (related products)
```diff
- <Link key={prod.id} href={`/store/${shop.slug}/${prod.slug}`}>
+ <Link key={prod.id} href={`/store/${shop.slug}/${prod.slug}`} className="group">
```

---

### Fix 2 · Change `aspect-video` → `aspect-square` on all product image containers

**Problem:** 16:9 aspect ratio crops product photos horizontally. Product photography
is square or portrait; `aspect-square` fills the card without wasting space.

**Files & lines:**

#### `src/app/(shopper)/marketplace/page.tsx` — line 305
```diff
- <div className="relative aspect-video bg-zinc-100 overflow-hidden">
+ <div className="relative aspect-square bg-zinc-100 overflow-hidden">
```

#### `src/app/(shopper)/store/[shopSlug]/page.tsx` — line 234
```diff
- <div className="relative aspect-video bg-zinc-100 overflow-hidden">
+ <div className="relative aspect-square bg-zinc-100 overflow-hidden">
```

#### `src/app/(shopper)/store/[shopSlug]/[productSlug]/page.tsx` — line 345 (related products grid)
```diff
- <div className="relative aspect-video bg-zinc-100 overflow-hidden">
+ <div className="relative aspect-square bg-zinc-100 overflow-hidden">
```

---

### Fix 3 · Split the "Ask seller / WhatsApp Buy" badge by stock state

**Problem:** `marketplace/page.tsx:352` uses `variant="success"` (green) for both states.
Sold-out products show a green badge saying "Ask seller" — green signals availability.

**File:** `src/app/(shopper)/marketplace/page.tsx` — lines 352–354

```diff
- <Badge variant="success" className="text-[10px] font-bold">
-   {prod.inStock === false ? 'Ask seller' : 'WhatsApp Buy'}
- </Badge>
+ {prod.inStock === false ? (
+   <Badge variant="secondary" className="text-[10px] font-bold text-zinc-500">
+     Ask seller
+   </Badge>
+ ) : (
+   <Badge variant="success" className="text-[10px] font-bold">
+     WhatsApp Buy
+   </Badge>
+ )}
```

---

### Fix 4 · Add top margin to `<RecentlyViewedStrip>` on marketplace

**Problem:** `<RecentlyViewedStrip />` at line 390 has no margin separating it from the
product grid / pagination block above it.

**File:** `src/app/(shopper)/marketplace/page.tsx` — line 390

```diff
- <RecentlyViewedStrip />
+ <div className="mt-16">
+   <RecentlyViewedStrip />
+ </div>
```

---

## Phase 2 — Structural fixes (15–30 min each)

### Fix 5 · Pagination links must carry all active filters

**Problem:** All three pagination `<Link>` elements only preserve `q`, `category`, and
`sort`. Navigating to page 2 silently drops `city`, `inStock`, `minPrice`, `maxPrice`.

**File:** `src/app/(shopper)/marketplace/page.tsx`

**Recommended approach — add a helper just before the `return` statement:**

```tsx
// Add after `const totalPages = ...` (line 255)
const buildPageUrl = (p: number) => {
  const ps = new URLSearchParams();
  if (query) ps.set('q', query);
  if (selectedCategory) ps.set('category', selectedCategory);
  if (selectedCity) ps.set('city', selectedCity);
  if (sort && sort !== 'newest') ps.set('sort', sort);
  if (inStockOnly) ps.set('inStock', '1');
  if (minPrice) ps.set('minPrice', minPrice);
  if (maxPrice) ps.set('maxPrice', maxPrice);
  ps.set('page', String(p));
  return `/marketplace?${ps.toString()}`;
};
```

**Then replace all three pagination links (lines 366, 374, 381):**

```diff
- <Link href={`/marketplace?q=${query}&category=${selectedCategory}&sort=${sort}&page=${page - 1}`} ...>
+ <Link href={buildPageUrl(page - 1)} ...>

- <Link key={pNum} href={`/marketplace?q=${query}&category=${selectedCategory}&sort=${sort}&page=${pNum}`}>
+ <Link key={pNum} href={buildPageUrl(pNum)}>

- <Link href={`/marketplace?q=${query}&category=${selectedCategory}&sort=${sort}&page=${page + 1}`} ...>
+ <Link href={buildPageUrl(page + 1)} ...>
```

---

### Fix 6 · Add ellipsis to pagination for large page counts

**Problem:** `Array.from({ length: totalPages })` at line 371 renders every page button
as a full-size button with no ellipsis. With 20+ pages this becomes a wall of numbers.

**File:** `src/app/(shopper)/marketplace/page.tsx` — lines 371–379

Replace the `Array.from` block with a windowed renderer:

```tsx
{(() => {
  const range: (number | '...')[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= page - 2 && i <= page + 2)
    ) {
      range.push(i);
    } else if (
      (i === 2 && page > 4) ||
      (i === totalPages - 1 && page < totalPages - 3)
    ) {
      range.push('...');
    }
  }
  return range.map((entry, idx) =>
    entry === '...' ? (
      <span key={`ellipsis-${idx}`} className="px-1 text-muted-foreground text-sm select-none">…</span>
    ) : (
      <Link key={entry} href={buildPageUrl(entry)}>
        <Button variant={page === entry ? 'default' : 'outline'} size="sm" className="h-8 w-8 p-0">
          {entry}
        </Button>
      </Link>
    )
  );
})()}
```

---

### Fix 7 · Product page: title visible before gallery on mobile

**Problem:** `[productSlug]/page.tsx:169` — `lg:grid-cols-3` grid with gallery in the
left `lg:col-span-2` column and the purchase CTA (containing the `<h1>`) in the right
column. On mobile, columns stack in DOM order: gallery appears first, `<h1>` second.
Buyers see photos before knowing the product name.

**File:** `src/app/(shopper)/store/[shopSlug]/[productSlug]/page.tsx`

**Line 171** — gallery column, add `order-last lg:order-first`:
```diff
- <div className="lg:col-span-2 flex flex-col gap-8">
+ <div className="lg:col-span-2 flex flex-col gap-8 order-last lg:order-first">
```

**Line 188** — CTA / sidebar column, add `order-first lg:order-last`:
```diff
- <div className="flex flex-col gap-6">
+ <div className="flex flex-col gap-6 order-first lg:order-last">
```

Result: on mobile the CTA card (with title + price) renders above the gallery.
On `lg+`, CSS order resets to DOM order so the gallery is left and CTA is right.

---

### Fix 8 · Make "How purchasing works" collapsible

**Problem:** `[productSlug]/page.tsx:233–241` — the amber info box is always visible in
the purchase sidebar, pushing the CTA button down on every visit. Repeat buyers don't
need it.

**File:** `src/app/(shopper)/store/[shopSlug]/[productSlug]/page.tsx` — lines 233–241

Replace the static `<div>` with a `<details>` element (no client JS required):

```diff
- {/* Order execution details helper */}
- <div className="rounded-lg bg-amber-500/5 border border-amber-500/10 p-4 mb-6 flex gap-3 text-xs leading-relaxed text-amber-800">
-   <Info className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
-   <div>
-     <p className="font-bold text-foreground">How purchasing works:</p>
-     <p className="mt-1">
-       Seyon connects you directly to the seller. Clicking the button below opens WhatsApp with a prefilled purchase inquiry message.
-     </p>
-   </div>
- </div>
+ {/* Order execution details helper — collapsible */}
+ <details className="rounded-lg bg-amber-500/5 border border-amber-500/10 mb-6 group/info">
+   <summary className="flex items-center gap-2 p-3 cursor-pointer text-xs text-amber-800 list-none select-none">
+     <Info className="h-4 w-4 shrink-0 text-amber-600" />
+     <span className="font-bold text-foreground">How purchasing works</span>
+     <span className="ml-auto text-[10px] text-amber-700 group-open/info:hidden">Show</span>
+     <span className="ml-auto text-[10px] text-amber-700 hidden group-open/info:inline">Hide</span>
+   </summary>
+   <p className="px-4 pb-4 text-xs text-amber-800 leading-relaxed">
+     Seyon connects you directly to the seller. Clicking the button below opens WhatsApp with a prefilled purchase inquiry message.
+   </p>
+ </details>
```

Note: `group/info` and `group-open/info:` are Tailwind v3.2+ named group variants.
If your Tailwind version is older, replace with a client component `useState` toggle.

---

## Phase 3 — Enhancements (30–60 min each)

### Fix 9 · Replace "No Image" text with an SVG placeholder

**Problem:** Three locations render `<div>No Image</div>` when a product has no image.
This looks broken rather than intentional.

**Create a shared component** at `src/frontend/components/shared/no-image-placeholder.tsx`:

```tsx
export function NoImagePlaceholder({ className }: { className?: string }) {
  return (
    <div className={`h-full w-full flex flex-col items-center justify-center gap-2 bg-zinc-50 text-zinc-300 ${className ?? ''}`}>
      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v13.5A1.5 1.5 0 003.75 21z" />
      </svg>
      <span className="text-[10px] font-semibold uppercase tracking-wider">No image</span>
    </div>
  );
}
```

**Replace in three places:**

| File | Line | Replace |
|------|------|---------|
| `marketplace/page.tsx` | 315–317 | `<NoImagePlaceholder />` |
| `store/[shopSlug]/page.tsx` | 244–246 | `<NoImagePlaceholder />` |
| `store/[shopSlug]/[productSlug]/page.tsx` | 355–357 | `<NoImagePlaceholder />` |

Add `import { NoImagePlaceholder } from '@/components/shared/no-image-placeholder';` to each.

---

### Fix 10 · Paginate store product listings

**Problem:** `getShopBySlug()` returns all active products at once. A store with 50+
listings causes a large payload on every store page view with no visible pagination.

**Step A — Update `getShopBySlug` in `src/actions/shops.ts`**

Add `page` and `perPage` parameters so the query accepts cursor-based slicing:

```ts
// In getShopBySlug, change the products include:
products: {
  where: { status: 'ACTIVE' },
  include: { images: { orderBy: { displayOrder: 'asc' }, take: 1 } },
  orderBy: [{ inStock: 'desc' }, { createdAt: 'desc' }],
  take: 12,   // first page hard-coded; extend to dynamic later
},
_count: {
  select: { products: { where: { status: 'ACTIVE' } } },
},
```

**Step B — Add a `StoreProductsGrid` client component**

Create `src/frontend/components/store/store-products-grid.tsx` as a `'use client'`
component that accepts `initialProducts`, `totalCount`, `shopSlug`, and `perPage`,
renders the grid, and has a "Load more" button that calls a server action to fetch
the next page and appends results to local state.

**Step C — Use it in `store/[shopSlug]/page.tsx`**

Replace the inline `activeProducts.map(...)` grid (lines 230–281) with:

```tsx
<StoreProductsGrid
  initialProducts={activeProducts}
  totalCount={shop._count.products}
  shopSlug={shop.slug}
  shopId={shop.id}
  perPage={12}
/>
```

---

## Verification checklist

After applying each phase, run:

```bash
# Lint
cd /path/to/project && npx next lint

# TypeScript
npx tsc --noEmit --skipLibCheck

# Visual spot-check pages
# /marketplace          — cards square, hover amber, badge colors, pagination
# /store/[slug]         — banner gradient, cards square, load more (Phase 3)
# /store/[slug]/[prod]  — title above gallery on mobile, info box collapsible
```

Sync changed files to `seller-portal/src/` and `buyer-market/src/` after each phase.

---

## File change summary

| File | Fixes applied |
|------|--------------|
| `src/app/(shopper)/marketplace/page.tsx` | 1, 2, 3, 4, 5, 6 |
| `src/app/(shopper)/store/[shopSlug]/page.tsx` | 1, 2, 9 |
| `src/app/(shopper)/store/[shopSlug]/[productSlug]/page.tsx` | 1, 2, 7, 8, 9 |
| `src/frontend/components/shared/no-image-placeholder.tsx` | 9 (new file) |
| `src/actions/shops.ts` | 10 (add `_count`) |
| `src/frontend/components/store/store-products-grid.tsx` | 10 (new file) |
