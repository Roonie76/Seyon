import { MetadataRoute } from 'next';
import { db } from '@/lib/db';
import { SITE_URL } from '@/lib/site';
import { logger } from '@/backend/lib/logger';

// Regenerate hourly at runtime. Without this the sitemap is baked once at
// build time (verified in prod testing: a DB hiccup during build shipped an
// empty sitemap until the next deploy).
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_URL;

  // Core Static routes
  const routes = [
    '',
    '/marketplace',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1.0 : 0.8,
  }));

  let shopUrls: MetadataRoute.Sitemap = [];
  let productUrls: MetadataRoute.Sitemap = [];
  let categoryUrls: MetadataRoute.Sitemap = [];

  try {
    const shops = await db.shop.findMany({
      where: { isSuspended: false, isPaused: false },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 5000, // sitemap cap; move to generateSitemaps (sitemap index) beyond this
    });

    const products = await db.product.findMany({
      where: { status: 'ACTIVE', shop: { isSuspended: false, isPaused: false } },
      select: { slug: true, updatedAt: true, shop: { select: { slug: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 40000, // stay under the 50k URLs-per-sitemap limit
    });

    shopUrls = shops.map((shop) => ({
      url: `${baseUrl}/store/${shop.slug}`,
      lastModified: new Date(shop.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));

    productUrls = products.map((prod) => ({
      url: `${baseUrl}/store/${prod.shop.slug}/${prod.slug}`,
      lastModified: new Date(prod.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));

    const categories = await db.product.groupBy({
      by: ['category'],
      where: { status: 'ACTIVE', shop: { isSuspended: false, isPaused: false } },
    });
    categoryUrls = categories.map((c) => ({
      url: `${baseUrl}/category/${encodeURIComponent(c.category.toLowerCase())}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }));
  } catch (error) {
    logger.warn('Database uninitialized, compiling empty list for dynamic sitemap paths', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return [...routes, ...categoryUrls, ...shopUrls, ...productUrls];
}
