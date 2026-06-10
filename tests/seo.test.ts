import { describe, it, expect } from 'vitest';
import {
  generateBreadcrumbJSONLD,
  generateItemListJSONLD,
  generateProductJSONLD,
  generateStoreJSONLD,
  safeJsonLdStringify,
} from '../src/shared/lib/seo';

const shop = {
  name: 'Vogue Boutique',
  slug: 'vogue',
  description: 'Fashion direct from Chennai',
  logo: null,
  banner: null,
  whatsapp: '+919999999999',
  createdAt: new Date('2026-01-01'),
  city: 'Chennai',
  region: 'Tamil Nadu',
};

const product = {
  title: 'Leather Jacket',
  slug: 'leather-jacket',
  description: 'Hand-stitched',
  price: 1350,
  category: 'Fashion',
  images: [{ url: 'https://img.example/1.jpg' }],
  inStock: false,
};

describe('generateBreadcrumbJSONLD', () => {
  it('builds positioned ListItems with absolute URLs', () => {
    const ld = generateBreadcrumbJSONLD([
      { name: 'Marketplace', url: '/marketplace' },
      { name: 'Fashion', url: '/category/fashion' },
    ]);
    expect(ld['@type']).toBe('BreadcrumbList');
    expect(ld.itemListElement).toHaveLength(2);
    expect(ld.itemListElement[0].position).toBe(1);
    expect(ld.itemListElement[1].item).toMatch(/^http.*\/category\/fashion$/);
  });
});

describe('generateItemListJSONLD', () => {
  it('lists products with positions and resolved URLs', () => {
    const ld = generateItemListJSONLD('Fashion on Seyon', [
      { title: 'A', url: '/store/x/a' },
      { title: 'B', url: 'https://other.example/b' },
    ]);
    expect(ld.numberOfItems).toBe(2);
    expect(ld.itemListElement[0].url).toMatch(/^http/);
    expect(ld.itemListElement[1].url).toBe('https://other.example/b');
  });
});

describe('generateProductJSONLD', () => {
  it('reports OutOfStock for sold-out products', () => {
    const ld = generateProductJSONLD(product, shop) as { offers: { availability: string } };
    expect(ld.offers.availability).toBe('https://schema.org/OutOfStock');
  });

  it('includes aggregateRating only when reviews exist', () => {
    const withRating = generateProductJSONLD(product, shop, { averageRating: 4.5, reviewCount: 7 }) as Record<string, unknown>;
    const noRating = generateProductJSONLD(product, shop, { averageRating: 0, reviewCount: 0 }) as Record<string, unknown>;
    expect(withRating.aggregateRating).toMatchObject({ ratingValue: '4.5', reviewCount: '7' });
    expect(noRating.aggregateRating).toBeUndefined();
  });
});

describe('generateStoreJSONLD', () => {
  it('includes a PostalAddress when city/region are set', () => {
    const ld = generateStoreJSONLD(shop, 80, 4.2, 3) as { address?: Record<string, string> };
    expect(ld.address).toMatchObject({
      '@type': 'PostalAddress',
      addressLocality: 'Chennai',
      addressRegion: 'Tamil Nadu',
    });
  });

  it('omits address when location is unknown', () => {
    const ld = generateStoreJSONLD({ ...shop, city: null, region: null }, 80, 4.2, 3) as { address?: unknown };
    expect(ld.address).toBeUndefined();
  });
});

describe('safeJsonLdStringify', () => {
  it('escapes script-breaking characters', () => {
    const out = safeJsonLdStringify({ x: '</script><script>alert(1)</script>' });
    expect(out).not.toContain('</script>');
    expect(out).toContain('\\u003c');
  });
});
