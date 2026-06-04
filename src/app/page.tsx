import Link from 'next/link';
import NextImage from 'next/image';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ShoppingBag, ArrowRight, MessageSquare, ShieldCheck, Globe } from 'lucide-react';
import { Product, Review } from '@prisma/client';

interface FallbackShop {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo: string | null;
  isVerified: boolean;
  products: Partial<Product>[];
  reviews?: Review[];
}

interface FallbackProduct {
  id: string;
  title: string;
  slug: string;
  price: number;
  category: string;
  shop: { slug: string; name: string };
  images: { url: string }[];
}

export default async function HomePage() {
  let popularShops: FallbackShop[] = [];
  let popularProducts: FallbackProduct[] = [];

  try {
    popularShops = await db.shop.findMany({
      where: { isSuspended: false },
      take: 3,
      include: {
        products: { where: { status: 'ACTIVE' } },
        reviews: true,
      },
    });

    popularProducts = await db.product.findMany({
      where: { status: 'ACTIVE', shop: { isSuspended: false } },
      take: 4,
      include: {
        images: { orderBy: { displayOrder: 'asc' }, take: 1 },
        shop: true,
      },
    });
  } catch {
    console.warn('Database not initialized or connection failed, falling back to static presentation on landing page');
  }

  // Fallbacks if DB is unmigrated or empty
  if (popularShops.length === 0) {
    popularShops = [
      {
        id: '1',
        name: 'Gadget Central',
        slug: 'gadget-central',
        description: 'Your premium hub for all things tech, from smartphones to mechanical keyboards.',
        logo: 'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?auto=format&fit=crop&w=150&h=150&q=80',
        isVerified: true,
        products: [{}, {}, {}],
      },
      {
        id: '2',
        name: 'Vogue Boutique',
        slug: 'vogue-boutique',
        description: 'Handcrafted sustainable streetwear, tailored to express your authentic aesthetic.',
        logo: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=150&h=150&q=80',
        isVerified: false,
        products: [{}, {}],
      },
    ];
  }

  if (popularProducts.length === 0) {
    popularProducts = [
      {
        id: 'p1',
        title: 'Keychron K2 Keyboard',
        slug: 'mechanical-keychron-k2-keyboard',
        price: 89.99,
        category: 'Electronics',
        shop: { slug: 'gadget-central', name: 'Gadget Central' },
        images: [{ url: 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=600&h=450&q=80' }],
      },
      {
        id: 'p2',
        title: 'Distressed Leather Jacket',
        slug: 'oversized-vintage-leather-jacket',
        price: 135.00,
        category: 'Fashion',
        shop: { slug: 'vogue-boutique', name: 'Vogue Boutique' },
        images: [{ url: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=600&h=450&q=80' }],
      },
    ];
  }

  const categories = [
    { name: 'Fashion', slug: 'fashion', count: '1,240+ products', color: 'from-pink-500/10 to-rose-500/10 text-rose-700 border-rose-200' },
    { name: 'Electronics', slug: 'electronics', count: '890+ products', color: 'from-blue-500/10 to-indigo-500/10 text-blue-700 border-blue-200' },
    { name: 'Home & Living', slug: 'home', count: '540+ products', color: 'from-amber-500/10 to-yellow-500/10 text-amber-700 border-amber-200' },
    { name: 'Beauty', slug: 'beauty', count: '310+ products', color: 'from-purple-500/10 to-violet-500/10 text-purple-700 border-purple-200' },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-16 md:pt-32 md:pb-24 lg:pt-40 bg-gradient-to-b from-amber-500/5 via-transparent to-transparent">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-yellow-500/5 rounded-full blur-[90px] pointer-events-none" />

        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center px-3.5 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-800 text-xs font-semibold mb-6 animate-pulse">
            Empowering 100k+ Social Sellers
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight max-w-4xl mx-auto leading-[1.1] mb-6 text-foreground">
            Turn Your Social Audience Into{' '}
            <span className="bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 bg-clip-text text-transparent">
              Direct Sales
            </span>
          </h1>
          <p className="text-muted-foreground text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Create a premium digital storefront in seconds. List products, share your store link on Instagram or Telegram, and receive orders directly in your WhatsApp chat.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/dashboard">
              <Button size="lg" className="w-full sm:w-auto text-base glow-border">
                Create Free Store <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/marketplace">
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-base">
                Explore Marketplace
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 md:py-24 border-t border-zinc-200 bg-zinc-50/50">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">Everything you need, nothing you don&apos;t.</h2>
            <p className="text-muted-foreground text-base">We remove the overhead of payments and logistics. You focus on selling; buyers connect with you instantly.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="glass-hover">
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6">
                  <MessageSquare className="h-6 w-6 text-amber-600" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">WhatsApp &quot;Chat to Buy&quot;</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Buyers browse your beautiful storefront and click &quot;Chat on WhatsApp&quot;. A pre-filled message with item details is sent to you instantly.
                </p>
              </CardContent>
            </Card>

            <Card className="glass-hover">
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6">
                  <Globe className="h-6 w-6 text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">Dynamic SEO Stores</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Automatic schema markup, canonical sitemaps, and optimized search performance ensure Google indexes and ranks your products.
                </p>
              </CardContent>
            </Card>

            <Card className="glass-hover">
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6">
                  <ShieldCheck className="h-6 w-6 text-amber-600" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">Social Proof & Trust</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Integrated review system and verified badges build buyer trust, generating an active trust rating score for each storefront.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16 md:py-24 border-t border-zinc-200">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-extrabold text-foreground mb-8 text-center md:text-left">Explore Categories</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories.map((cat) => (
              <Link key={cat.slug} href={`/marketplace?category=${cat.slug}`}>
                <div className={`p-6 rounded-lg border bg-gradient-to-br ${cat.color} flex flex-col justify-between h-36 hover:scale-[1.02] transition-transform cursor-pointer shadow-sm`}>
                  <span className="text-xl font-bold">{cat.name}</span>
                  <span className="text-xs opacity-80">{cat.count}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Stores Section */}
      <section className="py-16 md:py-24 border-t border-zinc-200 bg-zinc-50/30">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-12">
            <h2 className="text-2xl md:text-3xl font-extrabold text-foreground">Popular Storefronts</h2>
            <Link href="/marketplace" className="text-sm font-semibold text-amber-600 hover:text-amber-700 hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {popularShops.map((shop) => (
              <Link key={shop.id} href={`/store/${shop.slug}`}>
                <Card className="glass-hover h-full cursor-pointer">
                  <CardContent className="p-6 flex flex-col h-full justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="h-12 w-12 rounded-lg bg-zinc-50 border border-zinc-200 overflow-hidden flex items-center justify-center">
                          {shop.logo ? (
                            <NextImage src={shop.logo} alt={shop.name} width={48} height={48} className="h-full w-full object-cover" />
                          ) : (
                            <ShoppingBag className="h-5 w-5 text-muted-foreground/60" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-foreground flex items-center gap-1.5">
                            {shop.name}
                            {shop.isVerified && <ShieldCheck className="h-4 w-4 text-emerald-600" />}
                          </h3>
                          <span className="text-xs text-muted-foreground">/store/{shop.slug}</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-6 leading-relaxed">
                        {shop.description || 'No description provided.'}
                      </p>
                    </div>
                    <div className="text-xs text-amber-800 font-semibold border-t border-zinc-200 pt-4 flex justify-between">
                      <span>{shop.products.length} Products listed</span>
                      <span className="text-amber-600 hover:text-amber-700">Explore Store &rarr;</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Products Grid */}
      <section className="py-16 md:py-24 border-t border-zinc-200">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-12">
            <h2 className="text-2xl md:text-3xl font-extrabold text-foreground">Trending Products</h2>
            <Link href="/marketplace" className="text-sm font-semibold text-amber-600 hover:text-amber-700 hover:underline flex items-center gap-1">
              Shop Marketplace <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {popularProducts.map((prod) => (
              <Link key={prod.id} href={`/store/${prod.shop.slug}/${prod.slug}`}>
                <div className="rounded-lg overflow-hidden border border-zinc-200 bg-card hover:border-primary/40 hover:shadow-md transition-all duration-300 group cursor-pointer flex flex-col h-full justify-between shadow-sm">
                  <div className="relative aspect-video bg-zinc-100 overflow-hidden">
                    {prod.images?.[0] ? (
                      <NextImage
                        src={prod.images[0].url}
                        alt={prod.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">
                        No Image
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex flex-col justify-between flex-grow">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-amber-700 mb-1 block">
                        {prod.category}
                      </span>
                      <h3 className="font-bold text-foreground text-sm sm:text-base line-clamp-1 group-hover:text-amber-600 transition-colors">
                        {prod.title}
                      </h3>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3">
                      <span className="font-extrabold text-foreground text-sm sm:text-base">
                        ₹{prod.price.toFixed(2)}
                      </span>
                      <span className="text-xs text-emerald-600 font-bold flex items-center gap-0.5">
                        WhatsApp Buy
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 border-t border-zinc-200 bg-gradient-to-b from-transparent to-amber-500/5">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-b from-amber-500/5 to-amber-600/10 p-8 md:p-12 text-center relative overflow-hidden shadow-sm bg-card">
            <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-amber-500/5 rounded-full blur-[80px]" />
            <h2 className="text-3xl md:text-4xl font-black text-foreground mb-4">Ready to start selling?</h2>
            <p className="text-muted-foreground max-w-xl mx-auto mb-8 text-sm md:text-base">
              Join thousands of creators selling clothing, gadgets, tutorials, art, and food without any subscription fees or cut on your sales.
            </p>
            <Link href="/dashboard">
              <Button size="lg" className="px-8 shadow-lg shadow-amber-500/10">
                Setup Storefront Now
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
export const revalidate = 60; // Regenerate homepage every 60 seconds
