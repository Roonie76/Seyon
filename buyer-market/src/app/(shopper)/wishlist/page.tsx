import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getWishlistProducts } from '@/actions/wishlist';
import { WishlistButton } from '@/components/shared/wishlist-button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Heart, ArrowLeft } from 'lucide-react';

export default async function WishlistPage() {
  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    redirect('/login?callbackUrl=/wishlist');
  }

  const res = await getWishlistProducts();
  const products = res.success && res.products ? res.products : [];

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 bg-background text-foreground min-h-[70vh]">
      {/* Breadcrumbs & Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8 border-b border-zinc-200 pb-6">
        <div>
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Marketplace
          </Link>
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
            <Link key={prod.id} href={`/store/${prod.shop.slug}/${prod.slug}`}>
              <Card className="glass-hover overflow-hidden h-full flex flex-col justify-between cursor-pointer border-zinc-200 bg-card shadow-sm">
                <div className="relative aspect-video bg-zinc-100 overflow-hidden">
                  {prod.images?.[0] ? (
                    <Image
                      src={prod.images[0].url}
                      alt={prod.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">
                      No Image
                    </div>
                  )}
                  <div className="absolute top-2 right-2 z-10">
                    <WishlistButton
                      productId={prod.id}
                      initialIsWishlisted={true}
                    />
                  </div>
                </div>
                <div className="p-4 flex flex-col justify-between flex-grow">
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <span className="text-[10px] uppercase font-bold text-amber-700">
                        {prod.category}
                      </span>
                      <span className="text-xs text-muted-foreground text-right line-clamp-1 max-w-[120px]">
                        by {prod.shop.name}
                      </span>
                    </div>
                    <h3 className="font-bold text-foreground text-sm sm:text-base line-clamp-1 group-hover:text-amber-600 transition-colors">
                      {prod.title}
                    </h3>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3">
                    <span className="font-extrabold text-foreground text-base">
                      ₹{prod.price.toFixed(2)}
                    </span>
                    <Badge variant="success" className="text-[10px] font-bold">
                      WhatsApp Buy
                    </Badge>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';
