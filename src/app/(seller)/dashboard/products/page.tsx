import { redirect } from 'next/navigation';
import { SELLER_SHOP_SELECT, type SellerShopView } from '@/backend/lib/seller-shop-view';
import Link from 'next/link';
import { getSession } from '@/backend/lib/session';
import { db } from '@/lib/db';
import { ProductManager } from '@/components/dashboard/product-manager';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Product, ProductImage, ProductVariant } from '@prisma/client';
import { logger } from '@/backend/lib/logger';
import { LiveRefresh } from '@/components/dashboard/live-refresh';
import { BackButton } from '@/components/shared/back-button';
import { CatalogueFilters } from '@/components/dashboard/catalogue-filters';
import { ProductStatus, Prisma } from '@prisma/client';

/**
 * One page of the seller's own catalogue.
 *
 * Smaller than the storefront's 200, because this table carries controls,
 * images and per-product statistics for every row — and a seller working
 * through a catalogue is looking for something specific, which the search and
 * status filter answer better than a longer page does.
 */
const PAGE_SIZE = 50;

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}

export default async function DashboardProductsPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session || !session.user) {
    redirect('/api/auth/signin?callbackUrl=/dashboard/products');
  }

  const sp = await searchParams;
  const query = (sp.q ?? '').trim().slice(0, 80);
  const statusFilter =
    sp.status && sp.status in ProductStatus ? (sp.status as ProductStatus) : null;
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);

  // Load shop
  let shop: SellerShopView | null = null;
  let products: (Product & { images: ProductImage[]; variants: ProductVariant[] })[] = [];
  let total = 0;
  const clickStats: Record<string, { total: number; week: number; views: number }> = {};
  try {
    // Allowlist, not the bare row — this page hands the shop to a client
    // component too, and the moderation columns must not travel with it.
    shop = await db.shop.findUnique({
      where: { ownerId: session.user.id },
      select: SELLER_SHOP_SELECT,
    });

    if (shop) {
      /**
       * Bounded, filtered and paged.
       *
       * The public storefront caps itself at 200; the seller's own view did
       * not, and shipped every product with every image on every request of a
       * `force-dynamic` page. A cap alone only stops the bleeding — a seller
       * with 800 listings still could not reach the older ones, which is what
       * the search and the pager are for.
       */
      const where: Prisma.ProductWhereInput = {
        shopId: shop.id,
        ...(statusFilter ? { status: statusFilter } : {}),
        // Case-insensitive substring on the title. The seller is looking for a
        // product they named, not running a search engine.
        ...(query ? { title: { contains: query, mode: 'insensitive' as const } } : {}),
      };

      const [rows, count] = await Promise.all([
        db.product.findMany({
          where,
          include: {
            images: { orderBy: { displayOrder: 'asc' } },
            variants: { orderBy: { sortOrder: 'asc' } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        }),
        db.product.count({ where }),
      ]);
      products = rows;
      total = count;

      /**
       * Per-product outcomes: taps all-time, taps this week, and views.
       *
       * Views were the missing half. Every `PRODUCT_VIEW` row was written and
       * aggregated into a `productViews` field that no screen rendered, so a
       * seller could see how many people messaged them about a listing but not
       * how many people saw it — which is the pair that says whether a listing
       * is failing to attract attention or failing to convert it.
       */
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const [totals, weekly, views] = await Promise.all([
        db.analytics.groupBy({
          by: ['productId'],
          where: { shopId: shop.id, eventType: 'WHATSAPP_CLICK', productId: { not: null } },
          _count: { id: true },
        }),
        db.analytics.groupBy({
          by: ['productId'],
          where: { shopId: shop.id, eventType: 'WHATSAPP_CLICK', productId: { not: null }, createdAt: { gte: weekAgo } },
          _count: { id: true },
        }),
        db.analytics.groupBy({
          by: ['productId'],
          where: { shopId: shop.id, eventType: 'PRODUCT_VIEW', productId: { not: null } },
          _count: { id: true },
        }),
      ]);
      const bucket = (id: string) =>
        (clickStats[id] ??= { total: 0, week: 0, views: 0 });
      for (const row of totals) if (row.productId) bucket(row.productId).total = row._count.id;
      for (const row of weekly) if (row.productId) bucket(row.productId).week = row._count.id;
      for (const row of views) if (row.productId) bucket(row.productId).views = row._count.id;
    }
  } catch (error) {
    logger.error('Error fetching dashboard products', error, { userId: session.user.id });
  }

  // Redirect to onboarding if no shop exists
  if (!shop) {
    redirect('/dashboard');
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /** Keeps the current search and status filter while moving between pages. */
  const pageHref = (n: number) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (statusFilter) params.set('status', statusFilter);
    if (n > 1) params.set('page', String(n));
    const qs = params.toString();
    return `/dashboard/products${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 flex flex-col gap-6">
      {/* Back button */}
      <div>
        <BackButton fallbackHref="/dashboard" label="Back to Dashboard" />
      </div>

      <div className="border-b border-border pb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">Product Catalog</h1>
          <LiveRefresh isPaused={shop.isPaused} />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Upload products, manage statuses (Active/Draft/Archived), upload multiple images, and set primary cover images.
        </p>
      </div>

      {/* Keyed on the search term so the input follows a back-button navigation
          without an effect writing state on every render. */}
      <CatalogueFilters key={query} query={query} status={statusFilter} total={total} />

      <ProductManager shopId={shop.id} shopSlug={shop.slug} products={products} clickStats={clickStats} />

      {pageCount > 1 ? (
        <nav
          className="flex items-center justify-between gap-3 border-t border-border pt-4"
          aria-label="Catalogue pages"
        >
          <span className="text-xs text-muted-foreground tabular-nums">
            Page {page} of {pageCount} · {total} product{total === 1 ? '' : 's'}
          </span>
          <div className="flex gap-2">
            {/*
              Links rather than buttons, so a page is an address: a seller can
              bookmark "my drafts, page 2" and the back button behaves.
            */}
            <Button variant="outline" size="sm" disabled={page <= 1} asChild={page > 1}>
              {page > 1 ? <Link href={pageHref(page - 1)}>Previous</Link> : <span>Previous</span>}
            </Button>
            <Button variant="outline" size="sm" disabled={page >= pageCount} asChild={page < pageCount}>
              {page < pageCount ? <Link href={pageHref(page + 1)}>Next</Link> : <span>Next</span>}
            </Button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
export const dynamic = 'force-dynamic';
