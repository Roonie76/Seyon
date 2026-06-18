import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ProductManager } from '@/components/dashboard/product-manager';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Shop, Product, ProductImage } from '@prisma/client';
import { logger } from '@/backend/lib/logger';
import { LiveRefresh } from '@/components/dashboard/live-refresh';

export default async function DashboardProductsPage() {
  const session = await auth();
  if (!session || !session.user) {
    redirect('/api/auth/signin?callbackUrl=/dashboard/products');
  }

  // Load shop
  let shop: Shop | null = null;
  let products: (Product & { images: ProductImage[] })[] = [];
  const clickStats: Record<string, { total: number; week: number }> = {};
  try {
    shop = await db.shop.findUnique({
      where: { ownerId: session.user.id },
    });

    if (shop) {
      products = await db.product.findMany({
        where: { shopId: shop.id },
        include: {
          images: { orderBy: { displayOrder: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Per-product chat-to-buy clicks: all-time + trailing 7 days
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const [totals, weekly] = await Promise.all([
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
      ]);
      for (const row of totals) {
        if (row.productId) clickStats[row.productId] = { total: row._count.id, week: 0 };
      }
      for (const row of weekly) {
        if (row.productId) {
          clickStats[row.productId] = { ...(clickStats[row.productId] ?? { total: row._count.id, week: 0 }), week: row._count.id };
        }
      }
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
        <Link href="/dashboard">
          <Button variant="ghost" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground pl-0">
            <ArrowLeft size={14} /> Back to Dashboard
          </Button>
        </Link>
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

      <ProductManager shopId={shop.id} shopSlug={shop.slug} products={products} clickStats={clickStats} />
    </div>
  );
}
export const dynamic = 'force-dynamic';
