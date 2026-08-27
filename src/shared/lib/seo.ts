import { Metadata } from 'next';
import { SITE_URL } from './site';

interface ShopSEOInput {
  name: string;
  slug: string;
  description: string | null;
  logo: string | null;
  banner: string | null;
  whatsapp: string;
  createdAt: Date;
  city?: string | null;
  region?: string | null;
}

interface ProductSEOInput {
  title: string;
  slug: string;
  description: string | null;
  price: number;
  compareAtPrice?: number | null;
  category: string;
  images: { url: string }[];
  inStock?: boolean;
}

const PLATFORM_URL = SITE_URL;

/**
 * Generates OpenGraph and page metadata for a shop storefront.
 */
export function generateStoreMetadata(shop: ShopSEOInput): Metadata {
  const shopUrl = `${PLATFORM_URL}/store/${shop.slug}`;
  const title = `${shop.name} | Chat to Buy Storefront`;
  const description = shop.description || `Browse products on ${shop.name} and chat directly on WhatsApp to purchase.`;

  // No explicit images: the branded card from store/[shopSlug]/opengraph-image.tsx
  // (file convention) supplies og:image / twitter:image.
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
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
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

  // No explicit images: the branded card from [productSlug]/opengraph-image.tsx
  // (file convention) supplies og:image / twitter:image.
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
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
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

  if (shop.city || shop.region) {
    schema.address = {
      '@type': 'PostalAddress',
      ...(shop.city ? { addressLocality: shop.city } : {}),
      ...(shop.region ? { addressRegion: shop.region } : {}),
    };
  }

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
export function generateProductJSONLD(
  product: ProductSEOInput,
  shop: ShopSEOInput,
  rating?: { averageRating: number; reviewCount: number }
) {
  const shopUrl = `${PLATFORM_URL}/store/${shop.slug}`;
  const productUrl = `${PLATFORM_URL}/store/${shop.slug}/${product.slug}`;
  const images = product.images?.map((img) => img.url) || [];

  const aggregateRating =
    rating && rating.reviewCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: rating.averageRating.toFixed(1),
            reviewCount: rating.reviewCount.toString(),
            bestRating: '5',
            worstRating: '1',
          },
        }
      : {};

  return {
    ...aggregateRating,
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
      priceCurrency: 'INR',
      price: product.price.toString(),
      // Sale pricing: signal a time-bound offer so rich results show the deal
      ...(product.compareAtPrice != null && product.compareAtPrice > product.price
        ? { priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) }
        : {}),
      availability: product.inStock === false ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      seller: {
        '@type': 'OnlineStore',
        name: shop.name,
        url: shopUrl,
      },
    },
  };
}

/**
 * Schema.org BreadcrumbList for navigational chains
 * (e.g. Marketplace -> Category -> Store -> Product).
 */
export function generateBreadcrumbJSONLD(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${PLATFORM_URL}${item.url}`,
    })),
  };
}

/**
 * Schema.org BlogPosting for an article.
 *
 * The blog had no article-level structured data at all, while product and
 * store pages have carried it for months. For a page whose entire job is to
 * be found, that is the wrong way round: BlogPosting is what lets a search
 * engine or an assistant state who wrote a piece, when, and what it is about,
 * rather than inferring it from the markup.
 *
 * `image` takes a root-relative path for our own covers and is absolutised
 * here, because consumers of JSON-LD do not resolve relative URLs.
 */
export function generateBlogPostingJSONLD(post: {
  slug: string;
  title: string;
  excerpt: string;
  cover: string;
  author: string;
  date: Date;
  updatedAt: Date;
  keywords?: string[];
  wordCount?: number;
}) {
  const url = `${PLATFORM_URL}/blog/${post.slug}`;
  const image = post.cover.startsWith('http') ? post.cover : `${PLATFORM_URL}${post.cover}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline: post.title.slice(0, 110),
    description: post.excerpt,
    image,
    url,
    datePublished: post.date.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: { '@type': 'Organization', name: post.author, url: PLATFORM_URL },
    publisher: {
      '@type': 'Organization',
      name: 'Seyon',
      url: PLATFORM_URL,
      logo: { '@type': 'ImageObject', url: `${PLATFORM_URL}/favicon.ico` },
    },
    ...(post.keywords && post.keywords.length ? { keywords: post.keywords.join(', ') } : {}),
    ...(post.wordCount ? { wordCount: post.wordCount } : {}),
    isAccessibleForFree: true,
  };
}

/**
 * Schema.org Blog for /blog and the topic hubs, carrying the posts it lists.
 */
export function generateBlogJSONLD(
  name: string,
  description: string,
  path: string,
  posts: { slug: string; title: string; excerpt: string; date: Date }[]
) {
  const url = `${PLATFORM_URL}${path}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': url,
    name,
    description,
    url,
    publisher: { '@type': 'Organization', name: 'Seyon', url: PLATFORM_URL },
    blogPost: posts.map((p) => ({
      '@type': 'BlogPosting',
      headline: p.title.slice(0, 110),
      description: p.excerpt,
      url: `${PLATFORM_URL}/blog/${p.slug}`,
      datePublished: p.date.toISOString(),
    })),
  };
}

/**
 * Schema.org ItemList for product collection pages (marketplace, categories).
 */
export function generateItemListJSONLD(
  listName: string,
  products: { title: string; url: string }[]
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: listName,
    numberOfItems: products.length,
    itemListElement: products.map((prod, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: prod.title,
      url: prod.url.startsWith('http') ? prod.url : `${PLATFORM_URL}${prod.url}`,
    })),
  };
}

/**
 * Schema.org WebSite with SearchAction — enables the Google sitelinks
 * search box pointing at the marketplace search.
 */
export function generateWebsiteJSONLD() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${PLATFORM_URL}/#website`,
    name: 'Seyon',
    url: PLATFORM_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${PLATFORM_URL}/marketplace?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * Schema.org Organization for brand knowledge-panel signals.
 */
export function generateOrganizationJSONLD() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${PLATFORM_URL}/#organization`,
    name: 'Seyon',
    url: PLATFORM_URL,
    logo: `${PLATFORM_URL}/favicon.ico`,
    description:
      'Seyon is a social-commerce storefront platform where independent sellers list products and buyers order directly through WhatsApp.',
  };
}

/**
 * Schema.org FAQPage for question/answer content blocks.
 */
export function generateFAQJSONLD(items: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
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
