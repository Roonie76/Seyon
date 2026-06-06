import { MetadataRoute } from 'next';
import { db } from '@/lib/db';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

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

  try {
    const shops = await db.shop.findMany({
      where: { isSuspended: false },
      select: { slug: true, updatedAt: true },
    });

    const products = await db.product.findMany({
      where: { status: 'ACTIVE', shop: { isSuspended: false } },
      select: { slug: true, updatedAt: true, shop: { select: { slug: true } } },
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
  } catch {
    console.warn('Database uninitialized, compiling empty list for dynamic sitemap paths');
  }

  return [...routes, ...shopUrls, ...productUrls];
}
