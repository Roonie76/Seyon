import { Metadata } from 'next';

interface ShopSEOInput {
  name: string;
  slug: string;
  description: string | null;
  logo: string | null;
  banner: string | null;
  whatsapp: string;
  createdAt: Date;
}

interface ProductSEOInput {
  title: string;
  slug: string;
  description: string | null;
  price: number;
  category: string;
  images: { url: string }[];
}

const PLATFORM_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

/**
 * Generates OpenGraph and page metadata for a shop storefront.
 */
export function generateStoreMetadata(shop: ShopSEOInput): Metadata {
  const shopUrl = `${PLATFORM_URL}/store/${shop.slug}`;
  const title = `${shop.name} | Chat to Buy Storefront`;
  const description = shop.description || `Browse products on ${shop.name} and chat directly on WhatsApp to purchase.`;
  const imageUrl = shop.logo || shop.banner || `${PLATFORM_URL}/og-default.jpg`;

  return {
    title,
    description,
    alternates: {
      canonical: shopUrl,
    },
    openGraph: {
      title,
      description,
      url: shopUrl,
      siteName: 'Seyon Marketplace',
      images: [
        {
          url: imageUrl,
          width: 800,
          height: 600,
          alt: `${shop.name} Logo`,
        },
      ],
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  };
}

/**
 * Generates OpenGraph and page metadata for a product.
 */
export function generateProductMetadata(product: ProductSEOInput, shop: ShopSEOInput): Metadata {
  const productUrl = `${PLATFORM_URL}/store/${shop.slug}/${product.slug}`;
  const title = `${product.title} - Buy from ${shop.name}`;
  const description = product.description || `Buy ${product.title} in ${product.category} from ${shop.name}. Chat on WhatsApp to complete transaction.`;
  const imageUrl = product.images?.[0]?.url || `${PLATFORM_URL}/og-default.jpg`;

  return {
    title,
    description,
    alternates: {
      canonical: productUrl,
    },
    openGraph: {
      title,
      description,
      url: productUrl,
      siteName: 'Seyon Marketplace',
      images: [
        {
          url: imageUrl,
          width: 800,
          height: 600,
          alt: product.title,
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  };
}

/**
 * Generates Schema.org JSON-LD structured data for a Shop (LocalBusiness / Store)
 */
export function generateStoreJSONLD(shop: ShopSEOInput, trustScore: number, averageRating: number, reviewCount: number) {
  const shopUrl = `${PLATFORM_URL}/store/${shop.slug}`;
  const logoUrl = shop.logo || `${PLATFORM_URL}/favicon.ico`;

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    '@id': shopUrl,
    name: shop.name,
    description: shop.description || '',
    url: shopUrl,
    logo: logoUrl,
    image: shop.banner || logoUrl,
    telephone: shop.whatsapp,
    dateCreated: shop.createdAt.toISOString(),
    knowsAbout: ['Social Commerce', 'Direct Messaging Sales'],
  };

  // Add AggregateRating if reviews exist
  if (reviewCount > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: averageRating.toString(),
      reviewCount: reviewCount.toString(),
      bestRating: '5',
      worstRating: '1',
    };
  }

  return schema;
}

/**
 * Generates Schema.org JSON-LD structured data for a Product
 */
export function generateProductJSONLD(product: ProductSEOInput, shop: ShopSEOInput) {
  const shopUrl = `${PLATFORM_URL}/store/${shop.slug}`;
  const productUrl = `${PLATFORM_URL}/store/${shop.slug}/${product.slug}`;
  const images = product.images?.map((img) => img.url) || [];

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': productUrl,
    name: product.title,
    image: images,
    description: product.description || '',
    category: product.category,
    offers: {
      '@type': 'Offer',
      url: productUrl,
      priceCurrency: 'USD',
      price: product.price.toString(),
      availability: 'https://schema.org/InStock',
      seller: {
        '@type': 'OnlineStore',
        name: shop.name,
        url: shopUrl,
      },
    },
  };
}

/**
 * Safely serializes JSON-LD schemas for inclusion in HTML script tags to prevent XSS script injection.
 */
export function safeJsonLdStringify(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

