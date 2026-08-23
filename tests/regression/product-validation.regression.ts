/**
 * Regression tests for defects found in the August 2026 adversarial audit.
 *
 * These assert the CORRECT behaviour, so they are RED until the corresponding
 * defect is fixed. They are intentionally kept out of `npm test` (see
 * `npm run test:regression`) so the existing green suite is not disturbed.
 *
 * Each test names the audit finding it guards.
 */
import { describe, it, expect } from 'vitest';
import { ProductSchema, ProductImageSchema } from '@/lib/zod-schemas';
import { slugify } from '@/shared/lib/slugify';

describe('F-07 non-ASCII and blank titles must not produce empty/degenerate slugs', () => {
  it('a Tamil title produces a usable slug', () => {
    expect(slugify('மணிமாலை நகை')).not.toBe('-');
    expect(slugify('மணிமாலை நகை').replace(/-/g, '')).not.toBe('');
  });

  it('a Devanagari title produces a usable slug', () => {
    expect(slugify('सोने का हार').replace(/-/g, '')).not.toBe('');
  });

  it('an emoji-only title produces a usable slug', () => {
    expect(slugify('🌸🌸🌸').replace(/-/g, '')).not.toBe('');
  });

  it('two different non-Latin titles do not collapse to the same slug', () => {
    expect(slugify('மணிமாலை நகை')).not.toBe(slugify('சங்கிலி'));
  });
});

describe('F-07b whitespace-only titles must be rejected', () => {
  it('ProductSchema rejects a whitespace-only title', () => {
    const r = ProductSchema.safeParse({
      title: '   ',
      price: 10,
      category: 'Fashion',
      images: [{ url: 'https://images.unsplash.com/x.jpg' }],
    });
    expect(r.success).toBe(false);
  });
});

describe('F-18 price must not silently accept junk numeric strings', () => {
  it('rejects "12abc" instead of coercing it to 12', () => {
    const r = ProductSchema.safeParse({
      title: 'Junk price',
      price: '12abc',
      category: 'Fashion',
      images: [{ url: 'https://images.unsplash.com/x.jpg' }],
    });
    expect(r.success).toBe(false);
  });

  it('rejects a non-finite price', () => {
    const r = ProductSchema.safeParse({
      title: 'Infinite price',
      price: '1e400',
      category: 'Fashion',
      images: [{ url: 'https://images.unsplash.com/x.jpg' }],
    });
    expect(r.success).toBe(false);
  });

  it('rejects an absurd price above any plausible catalogue value', () => {
    const r = ProductSchema.safeParse({
      title: 'Huge price',
      price: 1e308,
      category: 'Fashion',
      images: [{ url: 'https://images.unsplash.com/x.jpg' }],
    });
    expect(r.success).toBe(false);
  });
});

describe('F-17 category must be constrained server-side', () => {
  it('rejects a category outside the published list', () => {
    const r = ProductSchema.safeParse({
      title: 'Weird category',
      price: 10,
      category: '<script>evil</script>',
      images: [{ url: 'https://images.unsplash.com/x.jpg' }],
    });
    expect(r.success).toBe(false);
  });
});

describe('F-02/F-05 image URLs must be restricted to configured hosts and schemes', () => {
  it('rejects a javascript: URL', () => {
    expect(ProductImageSchema.safeParse({ url: 'javascript:alert(1)' }).success).toBe(false);
  });

  it('rejects a private/loopback host (SSRF and next/image poisoning)', () => {
    expect(ProductImageSchema.safeParse({ url: 'http://127.0.0.1:5432/' }).success).toBe(false);
    expect(ProductImageSchema.safeParse({ url: 'http://169.254.169.254/latest/meta-data/' }).success).toBe(false);
  });

  it('rejects a host that next.config.ts remotePatterns does not allow', () => {
    expect(ProductImageSchema.safeParse({ url: 'https://evil.example.com/a.png' }).success).toBe(false);
  });

  it('accepts a Supabase storage URL', () => {
    expect(
      ProductImageSchema.safeParse({ url: 'https://abc.supabase.co/storage/v1/object/public/products/a.png' }).success
    ).toBe(true);
  });
});

describe('F-19 compare-at price must be greater than the selling price', () => {
  it('rejects a compare-at price below the price', () => {
    const r = ProductSchema.safeParse({
      title: 'Fake discount',
      price: 500,
      compareAtPrice: 100,
      category: 'Fashion',
      images: [{ url: 'https://images.unsplash.com/x.jpg' }],
    });
    expect(r.success).toBe(false);
  });
});

describe('F-04 updates must carry a concurrency token', () => {
  it('ProductSchema exposes a version/updatedAt field for optimistic locking', () => {
    const shape = (ProductSchema as unknown as { shape: Record<string, unknown> }).shape;
    expect(Object.keys(shape)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^(version|updatedAt|expectedUpdatedAt)$/)])
    );
  });
});
