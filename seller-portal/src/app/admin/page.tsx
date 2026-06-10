import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getAdminDashboardStats } from '@/actions/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminModeration } from '@/components/admin/admin-moderation';
import { Role, Report, Shop } from '@prisma/client';
import { Users, ShoppingBag, Store, AlertTriangle, ShieldCheck } from 'lucide-react';
import { logger } from '@/backend/lib/logger';

type AdminReport = Report & {
  shop: { name: string; slug: string };
  user: { name: string | null; email: string | null };
};

type AdminStore = Shop & {
  owner: { email: string | null };
};

interface PopularShop {
  name: string;
  slug: string;
  views: number;
}

interface PopularProduct {
  title: string;
  slug: string;
  shopSlug: string;
  views: number;
}

export default async function AdminPage() {
  const session = await auth();
  if (!session || !session.user || session.user.role !== Role.ADMIN) {
    redirect('/');
  }

  // Load admin stats
  let stats = { totalSellers: 0, totalProducts: 0, totalStores: 0, dailySignups: 0, reportsCount: 0 };
  let reports: AdminReport[] = [];
  let popularShops: PopularShop[] = [];
  let popularProducts: PopularProduct[] = [];
  let allStores: AdminStore[] = [];

  try {
    const res = await getAdminDashboardStats();
    if (res.success && res.stats) {
      stats = res.stats;
      reports = res.reports as AdminReport[];
      popularShops = res.popularShops as PopularShop[];
      popularProducts = res.popularProducts as PopularProduct[];
      allStores = res.allStores as AdminStore[];
    }
  } catch (error) {
    logger.error('Error fetching admin page stats', error);
  }

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 flex flex-col gap-8">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground flex items-center gap-2">
          <ShieldCheck size={28} className="text-primary" /> Admin Moderation Panel
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Review buyer abuse reports, moderate storefront verification badges, and suspend fraudulent shops.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <Card className="glass">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase">Sellers</span>
              <span className="text-3xl font-black text-foreground block mt-1">{stats.totalSellers}</span>
            </div>
            <div className="h-10 w-10 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-center text-primary">
              <Users size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase">Shops</span>
              <span className="text-3xl font-black text-foreground block mt-1">{stats.totalStores}</span>
            </div>
            <div className="h-10 w-10 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-center text-primary">
              <Store size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase">Products</span>
              <span className="text-3xl font-black text-foreground block mt-1">{stats.totalProducts}</span>
            </div>
            <div className="h-10 w-10 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-center text-primary">
              <ShoppingBag size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase">Reports</span>
              <span className="text-3xl font-black text-foreground block mt-1">{stats.reportsCount}</span>
            </div>
            <div className="h-10 w-10 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-center text-red-650">
              <AlertTriangle size={20} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Interactive Moderation Lists */}
        <div className="lg:col-span-2">
          <AdminModeration reports={reports} allStores={allStores} />
        </div>

        {/* Analytics Highlights */}
        <div className="flex flex-col gap-6">
          <Card className="glass">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Most Viewed Stores</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {popularShops.length === 0 ? (
                <p className="text-xs text-muted-foreground">No traffic view metrics logged.</p>
              ) : (
                popularShops.map((shop, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm border-b border-border pb-2 last:border-0">
                    <a href={`/store/${shop.slug}`} target="_blank" className="font-bold text-foreground hover:underline">
                      {shop.name}
                    </a>
                    <span className="text-xs text-muted-foreground font-semibold">{shop.views} views</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Most Viewed Products</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {popularProducts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No traffic views logged on items.</p>
              ) : (
                popularProducts.map((prod, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm border-b border-border pb-2 last:border-0">
                    <a href={`/store/${prod.shopSlug}/${prod.slug}`} target="_blank" className="font-bold text-foreground hover:underline line-clamp-1 max-w-[170px]">
                      {prod.title}
                    </a>
                    <span className="text-xs text-muted-foreground font-semibold">{prod.views} views</span>
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
