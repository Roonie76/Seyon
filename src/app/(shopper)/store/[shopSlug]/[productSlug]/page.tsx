import { notFound } from 'next/navigation';
import Link from 'next/link';
import { SafeImage as Image } from '@/components/shared/safe-image';
import { db } from '@/lib/db';
import { Breadcrumbs } from '@/components/shared/breadcrumbs';
import { NoImagePlaceholder } from '@/components/shared/no-image-placeholder';
import { BackButton } from '@/components/shared/back-button';

interface RelatedProduct {
  id: string;
  title: string;
  slug: string;
  price: number;
  category: string;
  images: { url: string }[];
}
import { trackEventInternal } from '@/backend/lib/analytics';
import { generateProductMetadata, generateProductJSONLD, generateBreadcrumbJSONLD, safeJsonLdStringify } from '@/lib/seo';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import RatingsStars from '@/components/shared/ratings-stars';
import TrustBadge from '@/components/shared/trust-badge';
import ProductGallery from '@/components/store/product-gallery';
import { ReportModal } from '@/components/store/store-client-buttons';
import { ProductCTA } from '@/components/store/product-cta';
import { ShareButton } from '@/components/shared/share-button';
import { StickyBuyBar } from '@/components/store/sticky-buy-bar';
import { RecordRecentlyViewed, RecentlyViewedStrip } from '@/components/shared/recently-viewed';
import { WishlistButton } from '@/components/shared/wishlist-button';
import { ProductCard } from '@/components/shared/product-card';
import { isProductWishlisted } from '@/actions/wishlist';
import { RatingsHistogram } from '@/components/shared/ratings-histogram';
import { ShoppingBag, ArrowLeft, ShieldCheck, Tag, MapPin, PauseCircle } from 'lucide-react';
import { logger } from '@/backend/lib/logger';
import { DeliveryOffersList } from '@/components/shared/delivery-offers';

interface ProductPageProps {
  params: Promise<{
    shopSlug: string;
    productSlug: string;
  }>;
}

export async function generateMetadata({ params }: ProductPageProps) {
  const resolvedParams = await params;
  const product = await db.product.findFirst({
    where: {
      slug: resolvedParams.productSlug,
      status: 'ACTIVE',
      shop: { slug: resolvedParams.shopSlug, isSuspended: false, isPaused: false },
    },
    include: {
      images: { orderBy: { displayOrder: 'asc' } },
      shop: true,
    },
  });

  if (!product) return { title: 'Product Not Found' };
  return generateProductMetadata(product, product.shop);
}

export default async function ProductPage({ params }: ProductPageProps) {
  const resolvedParams = await params;
  const { shopSlug, productSlug } = resolvedParams;

  const product = await db.product.findFirst({
    where: {
      slug: productSlug,
      status: 'ACTIVE',
      shop: { slug: shopSlug, isSuspended: false, isPaused: false },
    },
    include: {
      images: { orderBy: { displayOrder: 'asc' } },
      shop: {
        include: {
          owner: { select: { emailVerified: true, phone: true, createdAt: true } },
          reviews: true,
          reports: {
            where: { status: 'OPEN' },
            select: { id: true }, // Prevent leaking PII of reports to the frontend
          },
        },
      },
    },
  });

  if (!product) {
    return notFound();
  }

  // Mask the owner's phone number to protect personal privacy, preserving type check phone !== null
  if (product.shop && product.shop.owner) {
    product.shop.owner.phone = product.shop.owner.phone ? 'hidden' : null;
  }

  // Track product view metric asynchronously
  trackEventInternal(product.shopId, 'PRODUCT_VIEW', product.id).catch((err) => {
    logger.error('Analytics record error for product view', err, { shopId: product.shopId, productId: product.id });
  });

  const isWishlisted = await isProductWishlisted(product.id);

  const shop = product.shop;

  // Compute related items (same category, active, excluding this one)
  let relatedProducts: RelatedProduct[] = [];
  try {
    relatedProducts = await db.product.findMany({
      where: {
        shopId: shop.id,
        category: product.category,
        status: 'ACTIVE',
        NOT: { id: product.id },
      },
      include: {
        images: { orderBy: { displayOrder: 'asc' }, take: 1 },
      },
      take: 4,
    });
  } catch (error) {
    logger.error('Error fetching related products', error, { productId: product.id, category: product.category });
  }

  // Compute Review Statistics
  const reviewCount = shop.reviews.length;
  const averageRating =
    reviewCount > 0
      ? shop.reviews.reduce((acc, rev) => acc + rev.rating, 0) / reviewCount
      : 0;

  // Schema.org structured data injection
  const jsonLd = generateProductJSONLD(product, shop, { averageRating, reviewCount });
  const breadcrumbJsonLd = generateBreadcrumbJSONLD([
    { name: 'Marketplace', url: '/marketplace' },
    { name: product.category, url: `/category/${encodeURIComponent(product.category.toLowerCase())}` },
    { name: shop.name, url: `/store/${shop.slug}` },
    { name: product.title, url: `/store/${shop.slug}/${product.slug}` },
  ]);

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 bg-background text-foreground animate-fade-in">
      {/* Inject JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(breadcrumbJsonLd) }}
      />

      {/* Breadcrumbs & Back buttons */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8">
        <BackButton fallbackHref={`/store/${shop.slug}`} label="Back to Storefront" />
        <Breadcrumbs
          items={[
            { label: shop.name, href: `/store/${shop.slug}` },
            { label: product.category, href: `/category/${encodeURIComponent(product.category.toLowerCase())}` },
            { label: product.title },
          ]}
        />
      </div>

      {shop.isPaused && (
        <div className="mb-8 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-center gap-3 text-sm text-amber-800">
          <PauseCircle className="h-5 w-5 shrink-0 text-amber-600" />
          <span><strong>This seller is currently away.</strong> You can browse the catalog, but ordering is paused until they return.</span>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Gallery & Description Column */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          {/* Mobile-only: Title + Price above gallery so user sees product name first */}
          <div className="lg:hidden">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-800 border border-amber-500/20 mb-2 capitalize">
              <Tag size={10} /> {product.category}
            </span>
            <h1 className="text-xl font-extrabold text-foreground tracking-tight leading-tight mb-1">
              {product.title}
            </h1>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-black text-foreground">₹{product.price.toFixed(2)}</span>
              {product.compareAtPrice != null && product.compareAtPrice > product.price && (
                <>
                  <span className="text-sm text-muted-foreground line-through">₹{product.compareAtPrice.toFixed(2)}</span>
                  <Badge variant="gold-pill" className="text-[10px]">
                    {Math.round((1 - product.price / product.compareAtPrice) * 100)}% OFF
                  </Badge>
                </>
              )}
            </div>
          </div>
          <ProductGallery images={product.images} />

          {/* Product Description */}
          <Card className="glass">
            <CardContent className="p-6">
              <h2 className="text-lg font-bold text-foreground mb-4 border-b border-zinc-200 pb-3">
                Product Details
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
                {product.description || 'No description has been provided for this product by the seller.'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Purchase CTA and Store Widget Sidebar */}
        <div className="flex flex-col gap-6">
          <Card className="glass p-6">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-800 border border-amber-500/20 mb-4 capitalize">
              <Tag size={10} /> {product.category}
            </span>

            <h1 className="hidden lg:block text-2xl font-extrabold text-foreground tracking-tight leading-tight mb-2">
              {product.title}
            </h1>

            <div className="flex items-center justify-between mb-6">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-3xl font-black text-foreground">₹{product.price.toFixed(2)}</span>
                {product.compareAtPrice != null && product.compareAtPrice > product.price && (
                  <>
                    <span className="text-base text-muted-foreground line-through">₹{product.compareAtPrice.toFixed(2)}</span>
                    <Badge variant="gold-pill" className="text-[10px]">
                      {Math.round((1 - product.price / product.compareAtPrice) * 100)}% OFF
                    </Badge>
                  </>
                )}
                <span className="text-xs text-muted-foreground">INR</span>
              </div>
              <ShareButton
                title={product.title}
                url={`/store/${shop.slug}/${product.slug}`}
                text={`Check out ${product.title} on Seyon`}
              />
            </div>

            {(shop.city || shop.region) && (
              <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3 mb-4 flex gap-2.5 items-center text-xs text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0 text-amber-600" />
                <span className="font-semibold text-foreground">
                  Ships from {[shop.city, shop.region].filter(Boolean).join(', ')}
                </span>
              </div>
            )}

            <DeliveryOffersList deliveryNote={shop.deliveryNote} />

            {/* Order CTA */}
            <div className="flex flex-col gap-3">
              <ProductCTA
                shopId={shop.id}
                whatsappNumber={shop.whatsapp}
                shopName={shop.name}
                productId={product.id}
                productName={product.title}
                price={product.price}
                productUrl={`${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || ''}/store/${shop.slug}/${product.slug}`}
                options={product.options}
                inStock={product.inStock}
                shopPaused={shop.isPaused}
                imageUrl={product.images?.[0]?.url}
              />
              <WishlistButton
                productId={product.id}
                initialIsWishlisted={isWishlisted}
                variant="default"
                className="w-full"
              />
              <ReportModal shopId={shop.id} />
            </div>
          </Card>

          {/* Store profile card */}
          <Card className="glass p-6">
            <h3 className="font-bold text-foreground mb-4 border-b border-zinc-200 pb-2 text-xs uppercase tracking-wider text-muted-foreground">
              Seller Profile
            </h3>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-lg bg-zinc-50 border border-zinc-200 overflow-hidden flex items-center justify-center shrink-0">
                {shop.logo ? (
                  <Image src={shop.logo} alt={shop.name} width={48} height={48} className="h-full w-full object-cover" />
                ) : (
                  <ShoppingBag size={20} className="text-muted-foreground/30" />
                )}
              </div>
              <div>
                <Link href={`/store/${shop.slug}`} className="font-bold text-foreground hover:text-amber-600 transition-colors flex items-center gap-1">
                  {shop.name}
                  {shop.isVerified && <ShieldCheck className="h-4 w-4 text-emerald-600" />}
                </Link>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <RatingsStars rating={averageRating} size={12} />
                  <span className="text-xs font-semibold text-foreground">{averageRating.toFixed(1)}</span>
                </div>
              </div>
            </div>

            {reviewCount > 0 && (
              <div className="my-4 pt-3 border-t border-zinc-150 dark:border-zinc-800">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block mb-2">Seller Feedback</span>
                <RatingsHistogram reviews={shop.reviews} />
              </div>
            )}

            <Link href={`/store/${shop.slug}`}>
              <button className="w-full py-2.5 text-xs bg-zinc-100 border border-zinc-200 hover:bg-zinc-200 text-foreground rounded-md font-semibold transition-colors cursor-pointer">
                Visit Storefront Catalog
              </button>
            </Link>
          </Card>

          {/* Trust Score calculations */}
          <TrustBadge
            isVerified={shop.isVerified}
            emailVerified={shop.owner.emailVerified !== null}
            hasPhone={shop.owner.phone !== null}
            whatsappVerified={shop.whatsappVerifiedAt !== null}
            averageRating={averageRating}
            reviewCount={reviewCount}
            createdAt={shop.createdAt}
            openReportsCount={shop.reports.length}
          />
        </div>
      </div>

      <RecordRecentlyViewed
        item={{
          id: product.id,
          title: product.title,
          price: product.price,
          shopSlug: shop.slug,
          productSlug: product.slug,
          image: product.images?.[0]?.url,
        }}
      />
      <StickyBuyBar
        shopId={shop.id}
        whatsappNumber={shop.whatsapp}
        shopName={shop.name}
        productId={product.id}
        productName={product.title}
        price={product.price}
        compareAtPrice={product.compareAtPrice}
        productUrl={`${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || ''}/store/${shop.slug}/${product.slug}`}
        inStock={product.inStock}
        shopPaused={shop.isPaused}
      />
      <RecentlyViewedStrip excludeId={product.id} />

      {/* Related Products Section */}
      {relatedProducts.length > 0 && (
        <div className="mt-16 border-t border-zinc-200 pt-12">
          <h2 className="text-xl font-bold text-foreground mb-8">Other Products from this Store</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {relatedProducts.map((prod) => (
              <ProductCard
                key={prod.id}
                product={{ ...prod, shop }}
                showWishlistButton={false}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export const revalidate = 300;
