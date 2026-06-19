import Link from 'next/link';
import { db } from '@/lib/db';
import { Card } from '@/components/ui/card';
import { LayoutGrid } from 'lucide-react';
import { BackButton } from '@/components/shared/back-button';
import { generateBreadcrumbJSONLD, safeJsonLdStringify } from '@/lib/seo';
import { Breadcrumbs } from '@/components/shared/breadcrumbs';
import { logger } from '@/backend/lib/logger';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Browse All Categories',
  description:
    'Explore all product categories on Seyon. Find fashion, electronics, beauty, home goods, crafts, and more from independent sellers.',
};

export const revalidate = 60;

// Map category names to gradient accent colours for visual variety
const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  fashion: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20' },
  electronics: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/20' },
  beauty: { bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-400', border: 'border-fuchsia-500/20' },
  'home & living': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  'clay crafts': { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  'diy crafts': { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' },
  'art & collectibles': { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' },
  'food & beverages': { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
};

const defaultColor = { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' };

export default async function CategoryIndexPage() {
  let categories: { category: string; _count: { id: number } }[] = [];

  try {
    const grouped = await db.product.groupBy({
      by: ['category'],
      where: { status: 'ACTIVE', shop: { isSuspended: false, isPaused: false } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });
    categories = grouped;
  } catch (error) {
    logger.error('Error fetching categories for index page', error);
  }

  const breadcrumbJsonLd = generateBreadcrumbJSONLD([
    { name: 'Marketplace', url: '/marketplace' },
    { name: 'Categories', url: '/category' },
  ]);

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(breadcrumbJsonLd) }}
      />

      {/* Breadcrumbs & Back button */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <BackButton fallbackHref="/marketplace" label="Back to Marketplace" />
        <Breadcrumbs items={[{ label: 'Categories' }]} />
      </div>

      {/* Hero banner */}
      <div className="relative rounded-2xl border border-neutral-800 bg-neutral-900 p-8 md:p-12 mb-12 overflow-hidden shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <LayoutGrid className="h-5 w-5 text-amber-600" />
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight">
            Browse All Categories
          </h1>
        </div>
        <p className="text-muted-foreground text-sm max-w-xl">
          Discover products across every category. Find what you&apos;re looking for and order directly through WhatsApp.
        </p>
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-zinc-500 text-sm">No categories available yet. Check back soon!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {categories.map((cat) => {
            const slug = cat.category.toLowerCase();
            const colors = categoryColors[slug] || defaultColor;
            return (
              <Link key={cat.category} href={`/category/${encodeURIComponent(slug)}`}>
                <Card className="glass-hover h-full p-6 flex flex-col items-center justify-center text-center gap-3 border-border bg-card cursor-pointer group min-h-[140px]">
                  <div className={`h-12 w-12 rounded-xl ${colors.bg} ${colors.border} border flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <span className={`text-lg font-bold ${colors.text}`}>
                      {cat.category.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h2 className="font-bold text-white text-sm group-hover:text-amber-400 transition-colors">
                      {cat.category}
                    </h2>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      {cat._count.id} {cat._count.id === 1 ? 'product' : 'products'}
                    </p>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
