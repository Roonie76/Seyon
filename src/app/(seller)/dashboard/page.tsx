import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/backend/lib/session';
import { db } from '@/lib/db';
import { getShopAnalytics } from '@/actions/analytics';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import RatingsStars from '@/components/shared/ratings-stars';
import { StoreOnboardingForm, StoreSettingsForm } from '@/components/dashboard/store-forms';
import { ShareStoreCard } from '@/components/dashboard/share-store';
import { OnboardingChecklist } from '@/components/dashboard/onboarding-checklist';
import { LiveRefresh } from '@/components/dashboard/live-refresh';
import { AnalyticsChart } from '@/components/dashboard/analytics-chart';
import { ShoppingBag, Eye, MessageCircle, AlertCircle, ExternalLink, ShieldCheck, ShoppingCart, Bell } from 'lucide-react';
import { Review, Report } from '@prisma/client';
import {
  SELLER_SHOP_SELECT,
  DASHBOARD_FEED_LIMIT,
  type SellerShopView,
} from '@/backend/lib/seller-shop-view';
import { unreadNoticeCount } from '@/backend/lib/notices';
import { logger } from '@/backend/lib/logger';

/**
 * Note this is built from `SellerShopView`, not from `Shop`.
 *
 * The bare model carries the moderation columns, and this object is handed to
 * `StoreSettingsForm` — a client component — so `Shop` here put
 * `underReviewReason` into the page's serialized payload. The allowlist is the
 * fix; the narrowed type is what stops it coming back.
 */
type DashboardShop = SellerShopView & {
  reviews: (Review & { user: { name: string | null; email: string | null } })[];
  reports: Report[];
  _count: { products: number; reports: number };
};

interface AnalyticsChartItem {
  date: string;
  views: number;
  clicks: number;
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session || !session.user) {
    redirect('/api/auth/signin?callbackUrl=/dashboard');
  }

  const user = session.user;
  const buyerMarketUrl = process.env.BUYER_MARKET_URL || 'https://seyon-pied.vercel.app';

  // Check if shop exists
  let shop: DashboardShop | null = null;
  try {
    shop = await db.shop.findUnique({
      where: { ownerId: user.id },
      select: {
        ...SELLER_SHOP_SELECT,
        // Both feeds were unbounded. The header counts come from the
        // denormalised columns, so the panels only need a page of recent rows.
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: DASHBOARD_FEED_LIMIT,
          include: { user: { select: { name: true, email: true } } },
        },
        reports: {
          orderBy: { createdAt: 'desc' },
          take: DASHBOARD_FEED_LIMIT,
        },
        _count: {
          select: {
            products: true,
            // Counted in the database rather than by loading every report and
            // filtering in JS, which is what the open-report tile used to do.
            reports: { where: { status: 'OPEN' } },
          },
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching dashboard shop', error, { userId: user.id });
  }

  // A notice the seller never opens is the same as one never sent, so the count
  // is on the dashboard rather than only behind a link.
  const unreadNotices = shop ? await unreadNoticeCount(shop.id) : 0;

  // 1. Render onboarding if user has no shop
  if (!shop) {
    return (
      <div className="container mx-auto px-4 py-12 bg-background text-foreground animate-fade-in">
        <div className="text-center max-w-lg mx-auto mb-10">
          <h1 className="text-3xl font-extrabold text-foreground mb-2">Welcome to Seyon</h1>
          <p className="text-muted-foreground text-sm">
            You are one step away from deploying your catalog storefront. Provide your store details to begin.
          </p>
        </div>
        <StoreOnboardingForm />
      </div>
    );
  }

  // 2. Fetch traffic metrics
  let metrics = { views: 0, productViews: 0, whatsappClicks: 0 };
  let previous = { views: 0, productViews: 0, whatsappClicks: 0 };
  let windowDays = 30;
  let chartData: AnalyticsChartItem[] = [];
  try {
    const analyticsRes = await getShopAnalytics(shop.id);
    if (analyticsRes.success && analyticsRes.metrics) {
      metrics = analyticsRes.metrics as { views: number; productViews: number; whatsappClicks: number };
      previous = analyticsRes.previous as { views: number; productViews: number; whatsappClicks: number };
      windowDays = analyticsRes.windowDays ?? 30;
      chartData = analyticsRes.chartData as AnalyticsChartItem[];
    }
  } catch (error) {
    logger.error('Error loading analytics for dashboard page', error, { shopId: shop.id });
  }

  // Same stored aggregates the buyer-facing pages read, so a seller never sees
  // a different rating from the one shoppers see.
  const reviewCount = shop.reviewCount;
  const averageRating = shop.averageRating;

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 flex flex-col gap-8 bg-background text-foreground animate-fade-in">
      {/*
        Suspension, said out loud.

        The dashboard branched on `isPaused` and nothing else, so a suspended
        seller opened a normal-looking dashboard — working metrics, a live
        "Visit Storefront" button, an editable settings form — while every
        buyer saw a suspension page. They were never told, and the only route
        to an appeal is the notice this links to.
      */}
      {shop.isSuspended && (
        <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-4 flex items-start gap-3 shadow-xs">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-red-900">Your store is suspended</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Buyers see a suspension notice instead of your storefront, and your store cannot be
              edited while this lasts. The reason, and the box to reply in, are in your notices —
              a reply is how an appeal reaches us.
            </p>
            <Link
              href="/notices"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-red-800 underline underline-offset-2"
            >
              <Bell className="h-3.5 w-3.5" /> Read the notice and reply
            </Link>
          </div>
        </div>
      )}

      {/*
        Listed is not the same as onboarded.

        `isListed` is false until identity verification completes, and it is a
        hard filter on the marketplace, search, categories and the sitemap. The
        onboarding checklist asked for a logo, a number, three products and a
        city, then congratulated a seller who was still invisible — while the
        share card told them to post their link to start receiving orders.
      */}
      {!shop.isSuspended && !shop.isListed && (
        <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl p-4 flex items-start gap-3 shadow-xs">
          <ShieldCheck className="h-5 w-5 text-sky-700 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-sky-900">Your store is not in the marketplace yet</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Your direct link works and you can share it today — but until you verify your
              identity, your store will not appear in the marketplace, in search, or in category
              pages, so nobody will find it on their own.
            </p>
            <Link
              href="/verification"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-sky-800 underline underline-offset-2"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Finish verification
            </Link>
          </div>
        </div>
      )}

      {shop.isPaused && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3 shadow-xs">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-amber-850">Store is in Vacation Mode</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Your storefront is currently offline. Customers see a &ldquo;Currently away&rdquo; notice, order actions are disabled, and your products are hidden from the search catalog. You can reopen your store anytime from the settings below.
            </p>
          </div>
        </div>
      )}

      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-extrabold text-foreground">{shop.name}</h1>
              <LiveRefresh isPaused={shop.isPaused} />
            </div>
            {shop.isVerified && (
              <Badge variant="success" className="gap-0.5">
                <ShieldCheck size={12} /> Verified
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground block mt-1">
            Store URL: /store/{shop.slug}
          </span>
        </div>
        <div className="flex gap-3">
          <Link href={`${buyerMarketUrl}/store/${shop.slug}`} target="_blank">
            <Button variant="outline" className="gap-1.5 text-xs">
              <ExternalLink size={14} /> Visit Storefront
            </Button>
          </Link>
          <Link href="/notices">
            <Button variant="outline" className="gap-1.5 text-xs" data-testid="dashboard-notices-link">
              <Bell size={14} /> Notices
              {unreadNotices > 0 ? (
                <span
                  data-testid="dashboard-notices-badge"
                  className="ml-1 rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white"
                >
                  {unreadNotices}
                </span>
              ) : null}
            </Button>
          </Link>
          <Link href="/dashboard/products">
            <Button className="gap-1.5 text-xs">
              <ShoppingCart size={14} /> Manage Products
            </Button>
          </Link>
        </div>
      </div>

      {/*
        Every metric now says what window it covers.

        These cards were lifetime totals with no label, sitting directly above
        a seven-day chart. A seller reading 4,200 views took it as recent
        performance; it might have been two years old, and nothing on the page
        said whether traffic was rising or falling.
      */}
      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <Card className="glass">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase">Store Views</span>
              <span className="text-3xl font-black text-foreground block mt-1">{metrics.views}</span>
              <MetricWindow current={metrics.views} previous={previous.views} days={windowDays} />
            </div>
            <div className="h-10 w-10 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-center text-amber-600">
              <Eye size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase">Clicks</span>
              <span className="text-3xl font-black text-foreground block mt-1">{metrics.whatsappClicks}</span>
              <MetricWindow current={metrics.whatsappClicks} previous={previous.whatsappClicks} days={windowDays} />
            </div>
            <div className="h-10 w-10 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-600">
              <MessageCircle size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase">Products Listed</span>
              <span className="text-3xl font-black text-foreground block mt-1">{shop._count.products}</span>
            </div>
            <div className="h-10 w-10 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center text-blue-650">
              <ShoppingBag size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase">Open Reports</span>
              <span className="text-3xl font-black text-foreground block mt-1">
                {shop._count.reports}
              </span>
            </div>
            <div className="h-10 w-10 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-center justify-center text-yellow-650">
              <AlertCircle size={20} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Traffic Charts Card */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-foreground">Storefront Traffic Analytics</CardTitle>
          <CardDescription>Line representation of daily view rates and WhatsApp CTA click counts.</CardDescription>
        </CardHeader>
        <CardContent>
          <AnalyticsChart data={chartData} />
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Profile Settings form */}
        <div id="settings" className="lg:col-span-2">
          <StoreSettingsForm shop={shop} />
        </div>

        {/* Reviews and Reports */}
        <div className="flex flex-col gap-6">
          <OnboardingChecklist
            hasLogo={Boolean(shop.logo)}
            whatsappVerified={Boolean(shop.whatsappVerifiedAt)}
            productCount={shop._count.products}
            // `city || deliveryNote` ticked off a step labelled "city & delivery
            // info" when only the note was filled — and `city` is what feeds the
            // buyer-facing "ships from" line, so the checklist was marking done a
            // field that was still empty.
            hasLocation={Boolean(shop.city)}
            isListed={shop.isListed}
          />
          <ShareStoreCard shopSlug={shop.slug} buyerMarketUrl={buyerMarketUrl} />
          {/* Reviews Widget */}
          <Card className="glass">
            <CardHeader className="border-b border-zinc-200">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-1.5">
                Reviews Timeline ({reviewCount})
              </CardTitle>
              {reviewCount > 0 && (
                <div className="flex items-center gap-2 mt-1">
                  <RatingsStars rating={averageRating} size={12} />
                  <span className="text-xs font-bold text-foreground">({averageRating.toFixed(1)} / 5)</span>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-6 max-h-[350px] overflow-y-auto overscroll-contain space-y-4">
              {shop.reviews.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No buyer reviews received yet.</p>
              ) : (
                shop.reviews.map((rev) => (
                  <div
                    key={rev.id}
                    data-testid={rev.isHidden ? 'dashboard-review-hidden' : 'dashboard-review'}
                    className={`p-3 rounded-lg border text-xs ${
                      rev.isHidden ? 'bg-zinc-100 border-zinc-200 opacity-70' : 'bg-zinc-50 border-zinc-100'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-foreground">{rev.user.name || 'Anonymous User'}</span>
                      <RatingsStars rating={rev.rating} size={10} />
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{rev.comment}</p>
                    {rev.isHidden ? (
                      <p className="mt-2 rounded bg-white/70 p-2 text-[11px] font-semibold text-zinc-600">
                        Hidden by the Seyon team, and not counted towards your rating.
                        {rev.hiddenReason ? ` Reason: ${rev.hiddenReason}` : ''}
                      </p>
                    ) : null}
                    <span className="text-[11px] text-muted-foreground/60 block mt-2 text-right">
                      {new Date(rev.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Reports Warning Widget */}
          <Card className="glass">
            <CardHeader className="border-b border-zinc-200">
              <CardTitle className="text-base font-bold text-foreground">Buyer Reports</CardTitle>
              <CardDescription>Official notices filed by users regarding storefront listings.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 max-h-[250px] overflow-y-auto overscroll-contain space-y-3">
              {shop.reports.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Your store has a clean record. No reports filed.</p>
              ) : (
                shop.reports.map((rep) => (
                  <div key={rep.id} className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border capitalize ${rep.status === 'OPEN' ? 'text-red-750 bg-red-100 border-red-200 animate-pulse' : rep.status === 'RESOLVED' ? 'text-emerald-700 bg-emerald-100 border-emerald-200' : 'text-amber-705 bg-amber-100 border-amber-200'}`}>
                        {rep.status.replace('_', ' ').toLowerCase()}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(rep.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{rep.reason}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
export const dynamic = 'force-dynamic';

/**
 * The window a number covers, and how it compares with the one before it.
 *
 * A bare count answers "how many" and leaves "is this good?" unanswerable,
 * which is the question a seller actually has. Rendered small and underneath,
 * because the count is still the headline.
 */
function MetricWindow({
  current,
  previous,
  days,
}: {
  current: number;
  previous: number;
  days: number;
}) {
  // No prior period to compare against — say nothing rather than "+100%".
  const delta = previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
  const tone = delta === null ? '' : delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-600' : '';

  return (
    <span className="mt-1 block text-[11px] text-muted-foreground">
      last {days} days
      {delta !== null ? (
        <span className={`ml-1.5 font-semibold ${tone}`}>
          {delta > 0 ? '+' : ''}
          {delta}%
        </span>
      ) : null}
    </span>
  );
}
