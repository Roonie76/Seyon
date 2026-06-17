import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
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
import { ShoppingBag, Eye, MessageCircle, AlertCircle, ExternalLink, ShieldCheck, ShoppingCart } from 'lucide-react';
import { Shop, Review, Report } from '@prisma/client';
import { logger } from '@/backend/lib/logger';

type DashboardShop = Shop & {
  reviews: (Review & { user: { name: string | null; email: string | null } })[];
  reports: Report[];
  _count: { products: number };
};

interface AnalyticsChartItem {
  date: string;
  views: number;
  clicks: number;
}

export default async function DashboardPage() {
  const session = await auth();
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
      include: {
        reviews: {
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { name: true, email: true } } },
        },
        reports: {
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { products: true },
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching dashboard shop', error, { userId: user.id });
  }

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
  let chartData: AnalyticsChartItem[] = [];
  try {
    const analyticsRes = await getShopAnalytics(shop.id);
    if (analyticsRes.success && analyticsRes.metrics) {
      metrics = analyticsRes.metrics as { views: number; productViews: number; whatsappClicks: number };
      chartData = analyticsRes.chartData as AnalyticsChartItem[];
    }
  } catch (error) {
    logger.error('Error loading analytics for dashboard page', error, { shopId: shop.id });
  }

  // Calculate rating stats
  const reviewCount = shop.reviews.length;
  const averageRating =
    reviewCount > 0
      ? shop.reviews.reduce((acc: number, r) => acc + r.rating, 0) / reviewCount
      : 0;

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 flex flex-col gap-8 bg-background text-foreground animate-fade-in">
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
          <Link href="/dashboard/products">
            <Button className="gap-1.5 text-xs">
              <ShoppingCart size={14} /> Manage Products
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <Card className="glass">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase">Store Views</span>
              <span className="text-3xl font-black text-foreground block mt-1">{metrics.views}</span>
            </div>
            <div className="h-10 w-10 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-center text-amber-600">
              <Eye size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase">Clicks (Buy)</span>
              <span className="text-3xl font-black text-foreground block mt-1">{metrics.whatsappClicks}</span>
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
                {shop.reports.filter((r) => r.status === 'OPEN').length}
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
        <div className="lg:col-span-2">
          <StoreSettingsForm shop={shop} />
        </div>

        {/* Reviews and Reports */}
        <div className="flex flex-col gap-6">
          <OnboardingChecklist
            hasLogo={Boolean(shop.logo)}
            whatsappVerified={Boolean(shop.whatsappVerifiedAt)}
            productCount={shop._count.products}
            hasLocation={Boolean(shop.city || shop.deliveryNote)}
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
            <CardContent className="p-6 max-h-[350px] overflow-y-auto space-y-4">
              {shop.reviews.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No buyer reviews received yet.</p>
              ) : (
                shop.reviews.map((rev) => (
                  <div key={rev.id} className="p-3 bg-zinc-50 rounded-lg border border-zinc-100 text-xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-foreground">{rev.user.name || 'Anonymous User'}</span>
                      <RatingsStars rating={rev.rating} size={10} />
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{rev.comment}</p>
                    <span className="text-[10px] text-muted-foreground/60 block mt-2 text-right">
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
            <CardContent className="p-6 max-h-[250px] overflow-y-auto space-y-3">
              {shop.reports.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Your store has a clean record. No reports filed.</p>
              ) : (
                shop.reports.map((rep) => (
                  <div key={rep.id} className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border capitalize ${rep.status === 'OPEN' ? 'text-red-750 bg-red-100 border-red-200 animate-pulse' : rep.status === 'RESOLVED' ? 'text-emerald-700 bg-emerald-100 border-emerald-200' : 'text-amber-705 bg-amber-100 border-amber-200'}`}>
                        {rep.status.replace('_', ' ').toLowerCase()}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
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
