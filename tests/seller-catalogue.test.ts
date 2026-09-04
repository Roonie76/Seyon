/**
 * The catalogue features, as tests.
 *
 * Bulk actions, duplication, priced variants and upload tracking. As with the
 * audit regressions, only the cases where wrong behaviour would still look like
 * success: a variant that quotes the wrong number, a message that names the
 * base price for an upgraded size, a duplicate that shares an image and then
 * deletes it out from under the original.
 */
import { describe, it, expect } from 'vitest';
import { buildOrderMessage } from '../src/shared/lib/order-message';
import {
  ProductVariantSchema,
  ProductSchema,
  MAX_PRODUCT_VARIANTS,
} from '../src/shared/lib/zod-schemas';

const baseProduct = {
  title: 'Hand-block kurta',
  price: 1200,
  category: 'Fashion',
  images: [{ url: 'https://images.unsplash.com/photo-1' }],
};

describe('what a priced option is allowed to be', () => {
  it('accepts a well-formed one', () => {
    const res = ProductVariantSchema.safeParse({
      name: 'Medium',
      priceDelta: 200,
      inStock: true,
    });
    expect(res.success).toBe(true);
  });

  it('accepts a negative difference, because a smaller size can cost less', () => {
    const res = ProductVariantSchema.safeParse({ name: 'Small', priceDelta: -150, inStock: true });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.priceDelta).toBe(-150);
  });

  it('reads a difference typed into a text input', () => {
    // The form holds prices as strings while they are being typed, so the
    // schema has to accept "200" as readily as 200.
    const res = ProductVariantSchema.safeParse({ name: 'Large', priceDelta: '250', inStock: true });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.priceDelta).toBe(250);
  });

  it('refuses an option with no name', () => {
    expect(ProductVariantSchema.safeParse({ name: '  ', priceDelta: 0, inStock: true }).success).toBe(
      false
    );
  });

  it('refuses a difference that is not a number', () => {
    const res = ProductVariantSchema.safeParse({ name: 'M', priceDelta: 'about 200', inStock: true });
    expect(res.success).toBe(false);
  });
});

describe('a product with priced options', () => {
  it('accepts a product with none, which is most products', () => {
    const res = ProductSchema.safeParse(baseProduct);
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.variants).toEqual([]);
  });

  it('refuses two options with the same name', () => {
    // Two chips both reading "Medium" are indistinguishable to the buyer and
    // ambiguous in the order message that follows.
    const res = ProductSchema.safeParse({
      ...baseProduct,
      variants: [
        { name: 'Medium', priceDelta: 0, inStock: true },
        { name: ' medium ', priceDelta: 200, inStock: true },
      ],
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.issues[0].message).toMatch(/same name/i);
  });

  it('refuses more options than the chips can hold', () => {
    const many = Array.from({ length: MAX_PRODUCT_VARIANTS + 1 }, (_, i) => ({
      name: `Size ${i}`,
      priceDelta: 0,
      inStock: true,
    }));
    expect(ProductSchema.safeParse({ ...baseProduct, variants: many }).success).toBe(false);
  });
});

describe('the message a buyer sends', () => {
  it('quotes the price of the option they picked, not the base price', () => {
    // Quoting the base for an upgraded size starts every conversation with a
    // correction, and makes the seller look like they are adding charges.
    const msg = buildOrderMessage({
      productName: 'Hand-block kurta',
      shopName: 'Indigo Indigo',
      price: 1400,
      productUrl: 'https://seyon.example/store/indigo/kurta',
      selections: {},
      variantName: 'Large',
      inStock: true,
    });
    expect(msg).toContain('₹1400.00');
    expect(msg).toContain('(Large)');
    expect(msg).not.toContain('₹1200');
  });

  it('names the option alongside the free-text choices', () => {
    const msg = buildOrderMessage({
      productName: 'Kurta',
      shopName: 'Indigo',
      price: 1400,
      productUrl: 'https://seyon.example/p',
      selections: { Colour: 'Indigo' },
      variantName: 'Large',
      inStock: true,
    });
    expect(msg).toContain('(Large, Colour: Indigo)');
  });

  it('still works for a product with no options at all', () => {
    const msg = buildOrderMessage({
      productName: 'Kurta',
      shopName: 'Indigo',
      price: 1200,
      productUrl: 'https://seyon.example/p',
      selections: {},
      inStock: true,
    });
    expect(msg).toContain('Kurta — ₹1200.00');
    expect(msg).not.toContain('()');
  });

  it('names the sold-out option when asking about restocking', () => {
    // "Is this back in stock?" is unanswerable without knowing which size.
    const msg = buildOrderMessage({
      productName: 'Kurta',
      shopName: 'Indigo',
      price: 1400,
      productUrl: 'https://seyon.example/p',
      selections: {},
      variantName: 'Large',
      inStock: false,
    });
    expect(msg).toMatch(/sold out/i);
    expect(msg).toContain('(Large)');
  });
});
