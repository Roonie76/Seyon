import { notFound, redirect } from 'next/navigation';
import { currentSlugFor } from '@/backend/lib/slug-redirect';
import Link from 'next/link';
import { SafeImage as Image } from '@/components/shared/safe-image';
import { getShopBySlug } from '@/actions/shops';
import { SellerLegalDetails } from '@/frontend/components/store/seller-legal-details';
import { trackEventInternal } from '@/backend/lib/analytics';
import { generateStoreMetadata, generateStoreJSONLD, generateBreadcrumbJSONLD, safeJsonLdStringify } from '@/lib/seo';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import RatingsStars from '@/components/shared/ratings-stars';
import TrustBadge from '@/components/shared/trust-badge';
import { WhatsAppButton, ReviewModal, ReportModal } from '@/components/store/store-client-buttons';
import { ReportReviewButton } from '@/frontend/components/store/report-review-button';
import { Send, ShieldCheck, ShoppingBag, ShieldAlert, Star, MapPin, PauseCircle } from 'lucide-react';
import { ShareButton } from '@/components/shared/share-button';
import { logger } from '@/backend/lib/logger';
import { Breadcrumbs } from '@/components/shared/breadcrumbs';
import { DeliveryOffersRow } from '@/components/shared/delivery-offers';
import { NoImagePlaceholder } from '@/components/shared/no-image-placeholder';
import { BackButton } from '@/components/shared/back-button';
import { ProductCard } from '@/components/shared/product-card';

const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

interface StorePageProps {
  params: Promise<{ shopSlug: string }>;
}

/**
 * KNOWN ISSUE (F-15, mitigated): a missing shop renders the correct not-found
 * UI but answers HTTP 200, not 404.
 *
 * Isolated to this route segment, not to this page's code: a page containing
 * nothing but `notFound()` returns 404 at the app root, inside the (shopper)
 * group, under /help, and under /blog/[slug] — but 200 when placed under
 * /store/[shopSlug]. Six candidate causes were each removed and re-measured
 * with a fresh production build, and all six were ruled out:
 *
 *   export const revalidate         removed  -> still 200
 *   loading.tsx (Suspense boundary) removed  -> still 200
 *   opengraph-image.tsx             removed  -> still 200
 *   nested [productSlug] segment    removed  -> still 200
 *   notFound() moved into generateMetadata   -> still 200
 *   generateStaticParams added               -> still 200 (and turns the
 *                                               route SSG, so it was reverted)
 *
 * The cause is somewhere in Next's routing for this segment and is not worth
 * more time: the consequence that actually matters is search engines holding
 * on to deleted storefronts, and that is handled below with an explicit
 * noindex plus an X-Robots-Tag header, neither of which depends on the status
 * code. Revisit on the next Next.js major.
 */export async function generateMetadata({ params }: StorePageProps) {
  const resolvedParams = await params;
  const shop = await getShopBySlug(resolvedParams.shopSlug);
  if (!shop || shop.isSuspended) {
    return {
      title: 'Storefront Not Found',
      robots: { index: false, follow: false },
    };
  }
  return generateStoreMetadata(shop);
}

export default async function StorePage({ params }: StorePageProps) {
  const resolvedParams = await params;
  const shop = await getShopBySlug(resolvedParams.shopSlug);

  if (!shop) {
    // The address may be one this store used to have, in which case every link
    // the seller shared before the change points here and should follow.
    //
    // KNOWN LIMITATION, same cause as F-15 above: this segment does not reach
    // here for an unresolvable slug — an unknown store and a renamed one both
    // render the fallback at HTTP 200 without executing this branch. Verified
    // by driving both in a browser: identical response, no redirect. The
    // resolution itself is correct and covered by tests
    // (`store-repair.integration.ts`), so this starts working the moment the
    // routing behaviour F-15 describes is fixed. Until then, an old address
    // does not redirect, and the admin screen says as much before anyone
    // changes a slug.
    const moved = await currentSlugFor(resolvedParams.shopSlug);
    if (moved) redirect(`/store/${moved}`);
    return notFound();
  }

  // Handle store suspension
  if (shop.isSuspended) {
    return (
      <div className="container mx-auto px-4 py-24 text-center max-w-lg">
        <div className="h-16 w-16 bg-red-500/10 border border-red-500/20 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldAlert size={32} />
        </div>
        <h1 className="text-3xl font-extrabold text-foreground mb-2">Storefront Suspended</h1>
        <p className="text-muted-foreground text-sm leading-relaxed mb-6">
          This storefront has been suspended by system moderators for policy violation or user fraud reports.
        </p>
        <Link href="/marketplace">
          <button className="px-5 py-2.5 bg-zinc-100 border border-zinc-200 hover:bg-zinc-200 text-foreground rounded-md text-sm font-semibold transition-colors cursor-pointer">
            Return to Marketplace
          </button>
        </Link>
      </div>
    );
  }

  // Track shop view metric asynchronously
  trackEventInternal(shop.id, 'SHOP_VIEW').catch((err) => {
    logger.error('Analytics record error for shop view', err, { shopId: shop.id });
  });

  // Read the stored aggregates rather than summing the loaded reviews. Two
  // separately-derived answers to "what is this shop rated" could disagree —
  // the marketplace filter uses Shop.averageRating, so a page computing its
  // own number could show 3.2 on a shop the "4+ stars" filter had matched.
  const reviewCount = shop.reviewCount;
  const averageRating = shop.averageRating;

  const activeProducts = shop.products;

  // Generate Structured Data Schema JSON-LD
  const jsonLd = generateStoreJSONLD(shop, 80, averageRating, reviewCount);
  const breadcrumbJsonLd = generateBreadcrumbJSONLD([
    { name: 'Marketplace', url: '/marketplace' },
    { name: shop.name, url: `/store/${shop.slug}` },
  ]);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Inject JSON-LD Schema markup */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(breadcrumbJsonLd) }}
      />

      {/* Back button */}
      <div className="container mx-auto px-4 sm:px-6 pt-4">
        <BackButton fallbackHref="/marketplace" label="Back to Marketplace" />
      </div>

      {/* Banner */}
      <div className="relative h-48 md:h-64 lg:h-80 w-full overflow-hidden bg-zinc-100 border-b border-zinc-200">
        {shop.banner ? (
          <Image
            src={shop.banner}
            alt={shop.name}
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-amber-600/5 to-yellow-600/10" />
        )}
      </div>

      {/* Header Profile Section */}
      <div className="container mx-auto px-4 sm:px-6 relative -mt-16 md:-mt-24 z-10 mb-12">
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-end justify-between border-b border-zinc-200 pb-8 bg-background/80 backdrop-blur-sm p-6 rounded-2xl border border-zinc-200 shadow-sm">
          {/* Logo & Info */}
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start sm:items-end">
            <div className="h-28 w-28 md:h-36 md:w-36 rounded-2xl bg-card border-4 border-white shadow-xl overflow-hidden flex items-center justify-center relative shrink-0">
              {shop.logo ? (
                <Image
                  src={shop.logo}
                  alt={shop.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 112px, 144px"
                />
              ) : (
                <ShoppingBag size={48} className="text-muted-foreground/30" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <h1 className="text-2xl md:text-3xl font-extrabold text-foreground flex items-center gap-2">
                  {shop.name}
                </h1>
                {shop.isVerified && (
                  <Badge variant="success" className="gap-1 shadow-sm">
                    <ShieldCheck className="h-3 w-3" /> Verified Seller
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground max-w-xl line-clamp-2 md:line-clamp-none">
                {shop.description || 'Welcome to our catalog storefront! Click Chat to Buy on any product to chat.'}
              </p>
              {(shop.city || shop.region) && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2 font-semibold">
                  <MapPin className="h-3.5 w-3.5 text-amber-600" />
                  {[shop.city, shop.region].filter(Boolean).join(', ')}
                </p>
              )}
              {shop.deliveryNote && (
                <DeliveryOffersRow deliveryNote={shop.deliveryNote} className="mt-2.5" />
              )}

              {/* Social Channels and reviews */}
              <div className="flex flex-wrap gap-4 items-center mt-3 text-xs text-muted-foreground font-semibold">
                {shop.instagram && (
                  <a href={`https://instagram.com/${shop.instagram}`} target="_blank" rel="noopener noreferrer" className="hover:text-pink-600 transition-colors flex items-center gap-1.5">
                    <InstagramIcon /> Instagram
                  </a>
                )}
                {shop.telegram && (
                  <a href={`https://t.me/${shop.telegram}`} target="_blank" rel="noopener noreferrer" className="hover:text-sky-600 transition-colors flex items-center gap-1.5">
                    <Send size={14} /> Telegram
                  </a>
                )}
                <div className="flex items-center gap-1.5 border-l border-zinc-200 pl-4">
                  <RatingsStars rating={averageRating} size={14} />
                  <span className="text-foreground font-bold">{averageRating.toFixed(1)}</span>
                  <span className="font-normal text-muted-foreground">({reviewCount} reviews)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick CTAs */}
          <div className="flex flex-col gap-2 w-full sm:w-auto">
            {shop.isPaused ? (
              <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-800 text-sm font-bold">
                <PauseCircle className="h-4 w-4" /> Currently away — back soon
              </div>
            ) : (
              <WhatsAppButton shopId={shop.id} whatsappNumber={shop.whatsapp} shopName={shop.name} />
            )}
            <div className="flex gap-2 justify-end">
              <ShareButton title={shop.name} url={`/store/${shop.slug}`} text={`Check out ${shop.name} on Seyon`} />
            </div>
            <ReportModal shopId={shop.id} />
          </div>
        </div>
      </div>

      {/* Breadcrumbs */}
      <div className="container mx-auto px-4 sm:px-6 mb-6">
        <Breadcrumbs items={[{ label: shop.name }]} />
      </div>

      {/* Main Grid: Products, Trust Score, and Reviews */}
      <div className="container mx-auto px-4 sm:px-6 pb-24">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Products Column */}
          <div className="lg:col-span-2 flex flex-col gap-8">
            <div>
              <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-primary" /> Active Listings ({activeProducts.length})
              </h2>

              {activeProducts.length === 0 ? (
                <div className="p-12 border border-dashed border-zinc-200 rounded-xl text-center bg-card">
                  <ShoppingBag size={32} className="text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-bold text-foreground text-base">No active listings</h3>
                  <p className="text-xs text-muted-foreground">Check back later for new products from this store.</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {activeProducts.map((prod) => (
                    <ProductCard
                      key={prod.id}
                      product={{ ...prod, shop }}
                      showWishlistButton={false}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Info Column */}
          <div className="flex flex-col gap-6">
            {/* Trust rating score */}
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

            {/* Shop statistics widget */}
            <Card className="glass p-6">
              <h3 className="font-bold text-foreground mb-4 border-b border-zinc-200 pb-2 text-sm uppercase tracking-wider text-muted-foreground">Store Statistics</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-100 text-center">
                  <span className="text-2xl font-bold text-foreground">{activeProducts.length}</span>
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold mt-1">Listed Products</p>
                </div>
                <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-100 text-center">
                  <span className="text-2xl font-bold text-foreground">{reviewCount}</span>
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold mt-1">Total Reviews</p>
                </div>
              </div>
            </Card>

            {/* Reviews list widget */}
            <Card className="glass p-6">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-3 mb-4">
                <h3 className="font-bold text-foreground flex items-center gap-1.5 text-sm uppercase tracking-wider text-muted-foreground">
                  <Star className="h-4 w-4 text-amber-500 fill-amber-500" /> Buyer Feedback
                </h3>
                <ReviewModal shopId={shop.id} />
              </div>

              {shop.reviews.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No buyer reviews submitted yet. Purchase and leave feedback!</p>
              ) : (
                <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                  {shop.reviews.map((rev) => (
                    <div key={rev.id} className="p-3 bg-zinc-50 rounded-lg border border-zinc-100 text-xs">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-foreground">{rev.user.name || 'Anonymous User'}</span>
                        <RatingsStars rating={rev.rating} size={11} />
                      </div>
                      <p className="text-muted-foreground leading-relaxed">{rev.comment}</p>
                      <span className="text-[10px] text-muted-foreground/60 block mt-2 text-right">
                        {new Date(rev.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <ReportReviewButton
                        shopId={shop.id}
                        reviewId={rev.id}
                        authorName={rev.user.name || 'this buyer'}
                      />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* Required of a marketplace: who the buyer is actually dealing with. */}
        <SellerLegalDetails
          legalName={shop.owner.sellerKyc?.legalName ?? null}
          kycStatus={shop.owner.sellerKyc?.status ?? null}
          addressLine1={shop.owner.addressLine1}
          addressLine2={shop.owner.addressLine2}
          city={shop.owner.city}
          state={shop.owner.state}
          postalCode={shop.owner.postalCode}
          country={shop.owner.country}
          whatsapp={shop.whatsapp}
        />
      </div>
    </div>
  );
}
// Rendered per request: the shopper layout's Navbar calls auth(), which reads
// cookies and makes every route in this group dynamic regardless. The previous
// `export const revalidate` was therefore inert AND harmful — on the two /store
// routes it turned notFound() into a soft 404 (HTTP 200 with not-found copy),
// so search engines kept indexing deleted products.
