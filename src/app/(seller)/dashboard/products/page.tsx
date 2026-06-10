import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ProductManager } from '@/components/dashboard/product-manager';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Shop, Product, ProductImage } from '@prisma/client';
import { logger } from '@/backend/lib/logger';

export default async function DashboardProductsPage() {
  const session = await auth();
  if (!session || !session.user) {
    redirect('/api/auth/signin?callbackUrl=/dashboard/products');
  }

  // Load shop
  let shop: Shop | null = null;
  let products: (Product & { images: ProductImage[] })[] = [];
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
        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">Product Catalog</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Upload products, manage statuses (Active/Draft/Archived), upload multiple images, and set primary cover images.
        </p>
      </div>

      <ProductManager shopId={shop.id} products={products} />
    </div>
  );
}
export const dynamic = 'force-dynamic';
