import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { db } from '@/lib/db';

interface RelatedProduct {
  id: string;
  title: string;
  slug: string;
  price: number;
  category: string;
  images: { url: string }[];
}
import { trackEventInternal } from '@/backend/lib/analytics';
import { generateProductMetadata, generateProductJSONLD, safeJsonLdStringify } from '@/lib/seo';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import RatingsStars from '@/components/shared/ratings-stars';
import TrustBadge from '@/components/shared/trust-badge';
import ProductGallery from '@/components/store/product-gallery';
import { WhatsAppButton, ReportModal } from '@/components/store/store-client-buttons';
import { ShoppingBag, ArrowLeft, ShieldCheck, Tag, Info } from 'lucide-react';

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
      shop: { slug: resolvedParams.shopSlug, isSuspended: false },
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
      shop: { slug: shopSlug, isSuspended: false },
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
  trackEventInternal(product.shopId, 'PRODUCT_VIEW', product.id).catch((err) =>
    console.error('Analytics record error for product view:', err)
  );

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
    console.error('Error fetching related products:', error);
  }

  // Compute Review Statistics
  const reviewCount = shop.reviews.length;
  const averageRating =
    reviewCount > 0
      ? shop.reviews.reduce((acc, rev) => acc + rev.rating, 0) / reviewCount
      : 0;

  // Schema.org structured data injection
  const jsonLd = generateProductJSONLD(product, shop);

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 bg-background text-foreground animate-fade-in">
      {/* Inject JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
      />

      {/* Breadcrumbs & Back buttons */}
      <div className="flex justify-between items-center mb-8">
        <Link
          href={`/store/${shop.slug}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Storefront
        </Link>
        <span className="text-xs text-muted-foreground">
          Marketplace &rarr; {product.category} &rarr; {product.title}
        </span>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Gallery & Description Column */}
        <div className="lg:col-span-2 flex flex-col gap-8">
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

            <h1 className="text-2xl font-extrabold text-foreground tracking-tight leading-tight mb-2">
              {product.title}
            </h1>

            {/* Price tag */}
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-3xl font-black text-foreground">${product.price.toFixed(2)}</span>
              <span className="text-xs text-muted-foreground">USD</span>
            </div>

            {/* Order execution details helper */}
            <div className="rounded-lg bg-amber-500/5 border border-amber-500/10 p-4 mb-6 flex gap-3 text-xs leading-relaxed text-amber-800">
              <Info className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-bold text-foreground">How purchasing works:</p>
                <p className="mt-1">
                  Seyon connects you directly to the seller. Clicking the button below opens WhatsApp with a prefilled purchase inquiry message.
                </p>
              </div>
            </div>

            {/* Order CTA */}
            <div className="flex flex-col gap-3">
              <WhatsAppButton
                shopId={shop.id}
                whatsappNumber={shop.whatsapp}
                shopName={shop.name}
                productId={product.id}
                productName={product.title}
                price={product.price}
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
            averageRating={averageRating}
            reviewCount={reviewCount}
            createdAt={shop.createdAt}
            openReportsCount={shop.reports.length}
          />
        </div>
      </div>

      {/* Related Products Section */}
      {relatedProducts.length > 0 && (
        <div className="mt-16 border-t border-zinc-200 pt-12">
          <h2 className="text-xl font-bold text-foreground mb-8">Other Products from this Store</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {relatedProducts.map((prod) => (
              <Link key={prod.id} href={`/store/${shop.slug}/${prod.slug}`}>
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
                  </div>
                  <div className="p-4 flex-grow flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-amber-700 mb-1 block">
                        {prod.category}
                      </span>
                      <h3 className="font-bold text-foreground text-sm sm:text-base line-clamp-1 group-hover:text-amber-600 transition-colors">
                        {prod.title}
                      </h3>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3">
                      <span className="font-extrabold text-foreground text-base">
                        ${prod.price.toFixed(2)}
                      </span>
                      <Badge variant="success" className="text-[10px] font-bold">
                        Chat Buy
                      </Badge>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
export const revalidate = 5;
export async function generateStaticParams() {
  // Return empty list by default, letting pages generate dynamically (ISR fallback)
  return [];
}
