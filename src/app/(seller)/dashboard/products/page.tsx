import { redirect } from 'next/navigation';
import { SELLER_SHOP_SELECT, type SellerShopView } from '@/backend/lib/seller-shop-view';

/** A page of the seller's own catalogue. The storefront caps itself at 200 too. */
const SELLER_PRODUCT_LIMIT = 200;
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ProductManager } from '@/components/dashboard/product-manager';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Shop, Product, ProductImage } from '@prisma/client';
import { logger } from '@/backend/lib/logger';
import { LiveRefresh } from '@/components/dashboard/live-refresh';
import { BackButton } from '@/components/shared/back-button';

export default async function DashboardProductsPage() {
  const session = await auth();
  if (!session || !session.user) {
    redirect('/api/auth/signin?callbackUrl=/dashboard/products');
  }

  // Load shop
  let shop: SellerShopView | null = null;
  let products: (Product & { images: ProductImage[] })[] = [];
  let truncated = false;
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
       * Bounded. The public storefront caps itself at 200; the seller's own
       * view did not, and shipped every product with every image on every
       * request of a `force-dynamic` page.
       */
      const rows = await db.product.findMany({
        where: { shopId: shop.id },
        include: {
          images: { orderBy: { displayOrder: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        take: SELLER_PRODUCT_LIMIT + 1,
      });
      truncated = rows.length > SELLER_PRODUCT_LIMIT;
      products = rows.slice(0, SELLER_PRODUCT_LIMIT);

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

      {truncated ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Showing your {SELLER_PRODUCT_LIMIT} most recent products. Older listings are still live —
          they are just not loaded here.
        </p>
      ) : null}

      <ProductManager shopId={shop.id} shopSlug={shop.slug} products={products} clickStats={clickStats} />
    </div>
  );
}
export const dynamic = 'force-dynamic';
