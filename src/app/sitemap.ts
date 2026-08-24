import { MetadataRoute } from 'next';
import { DISCOVERABLE_SHOP } from '@/backend/lib/shop-visibility';
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
    '/about',
    '/contact',
    '/address',
    '/faqs',
    '/blog',
    '/category',
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
      where: DISCOVERABLE_SHOP,
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 5000, // sitemap cap; move to generateSitemaps (sitemap index) beyond this
    });

    const products = await db.product.findMany({
      where: { status: 'ACTIVE', shop: DISCOVERABLE_SHOP },
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
      where: { status: 'ACTIVE', shop: DISCOVERABLE_SHOP },
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

  let blogPostUrls: MetadataRoute.Sitemap = [];
  try {
    const dbPosts = await db.blogPost.findMany({
      where: { published: true },
      select: { slug: true, updatedAt: true },
    });
    blogPostUrls = dbPosts.map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: new Date(post.updatedAt),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }));
  } catch (error) {
    logger.warn('Failed to query blog posts for sitemap', { error });
  }

  return [...routes, ...blogPostUrls, ...categoryUrls, ...shopUrls, ...productUrls];
}
