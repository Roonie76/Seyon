import Link from 'next/link';
import { SafeImage as Image } from '@/components/shared/safe-image';
import { redirect } from 'next/navigation';
import { getSession } from '@/backend/lib/session';
import { getWishlistProducts } from '@/actions/wishlist';
import { WishlistButton } from '@/components/shared/wishlist-button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Heart, ArrowLeft } from 'lucide-react';
import { NoImagePlaceholder } from '@/components/shared/no-image-placeholder';
import { Breadcrumbs } from '@/components/shared/breadcrumbs';
import { BackButton } from '@/components/shared/back-button';
import { ProductCard } from '@/components/shared/product-card';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Wishlist',
  description: 'Products you have saved on Seyon.',
  // Personal and behind a login: useful to name, not to index.
  robots: { index: false, follow: true },
};

export default async function WishlistPage() {
  const session = await getSession();
  if (!session || !session.user || !session.user.id) {
    redirect('/login?callbackUrl=/wishlist');
  }

  const res = await getWishlistProducts();
  const products = res.success && res.products ? res.products : [];

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 bg-background text-foreground min-h-[70vh]">
      {/* Breadcrumbs & Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8 border-b border-zinc-200 pb-6">
        <div className="w-full">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-3">
            <BackButton fallbackHref="/marketplace" label="Back to Marketplace" />
            <Breadcrumbs items={[{ label: 'Wishlist' }]} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight flex items-center gap-2.5">
            <Heart className="h-8 w-8 text-rose-500 fill-rose-500" />
            My Wishlist
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Keep track of the handmade crafts and unique items you want to buy later.
          </p>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 md:p-20 border border-dashed border-zinc-200 rounded-xl bg-card shadow-sm text-center">
          <Heart className="h-16 w-16 text-rose-200 mb-4 animate-pulse" />
          <h3 className="text-xl font-bold text-foreground mb-2">Your wishlist is empty</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Explore the Seyon marketplace and click the heart icon on any product to save it to your wishlist.
          </p>
          <Link href="/marketplace">
            <Button className="bg-gradient-to-r from-amber-500 to-yellow-600 hover:brightness-105 text-black font-bold px-6 py-2 rounded-full shadow-md transition-all">
              Browse Marketplace
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {products.map((prod) => (
            <ProductCard
              key={prod.id}
              product={prod}
              initialIsWishlisted={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';
