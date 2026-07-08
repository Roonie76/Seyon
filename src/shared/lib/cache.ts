import { revalidatePath, revalidateTag } from 'next/cache';

export const PUBLIC_CACHE_TAGS = {
  marketplace: 'marketplace',
  shops: 'shops',
  products: 'products',
  categories: 'categories',
  shop: (slug: string) => `shop:${slug}`,
  product: (shopSlug: string, productSlug: string) => `product:${shopSlug}:${productSlug}`,
  category: (category: string) => `category:${category.toLowerCase()}`,
} as const;

export function revalidatePublicPaths(paths: string[]) {
  for (const path of paths) {
    revalidatePath(path);
  }
}

export function revalidatePublicTags(tags: string[]) {
  for (const tag of tags) {
    revalidateTag(tag, 'max');
  }
}

export function revalidateMarketplace() {
  revalidatePublicTags([
    PUBLIC_CACHE_TAGS.marketplace,
    PUBLIC_CACHE_TAGS.products,
    PUBLIC_CACHE_TAGS.categories,
  ]);
  revalidatePublicPaths(['/marketplace']);
}

export function revalidateShopSurface(shopSlug: string, productSlug?: string, category?: string) {
  const tags = [
    PUBLIC_CACHE_TAGS.marketplace,
    PUBLIC_CACHE_TAGS.shops,
    PUBLIC_CACHE_TAGS.products,
    PUBLIC_CACHE_TAGS.shop(shopSlug),
    // Homepage cache tags
    'homepage-just-discovered-v2',
    'homepage-hero-product',
    'homepage-featured-creators',
    'homepage-trending-products',
    'homepage-recently-added-stores',
    'homepage-trending-categories',
  ];

  const paths = [`/store/${shopSlug}`, '/marketplace', '/'];

  if (productSlug) {
    tags.push(PUBLIC_CACHE_TAGS.product(shopSlug, productSlug));
    paths.push(`/store/${shopSlug}/${productSlug}`);
  }

  if (category) {
    tags.push(PUBLIC_CACHE_TAGS.categories, PUBLIC_CACHE_TAGS.category(category));
    paths.push(`/category/${encodeURIComponent(category.toLowerCase())}`);
  }

  revalidatePublicTags(tags);
  revalidatePublicPaths(paths);
}
