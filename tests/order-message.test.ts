import { describe, it, expect } from 'vitest';
import { parseOptions, buildOrderMessage } from '../src/shared/lib/order-message';

describe('parseOptions', () => {
  it('parses labelled groups separated by middle dots', () => {
    expect(parseOptions('Sizes: S, M, L · Colors: Red, Black')).toEqual([
      { label: 'Sizes', values: ['S', 'M', 'L'] },
      { label: 'Colors', values: ['Red', 'Black'] },
    ]);
  });

  it('supports | and ; as group separators', () => {
    expect(parseOptions('Size: S, M | Color: Red; Material: Cotton')).toHaveLength(3);
  });

  it('treats plain comma lists as one unnamed group', () => {
    expect(parseOptions('Small, Medium, Large')).toEqual([
      { label: null, values: ['Small', 'Medium', 'Large'] },
    ]);
  });

  it('ignores empty segments and trims whitespace', () => {
    expect(parseOptions('  Sizes :  S ,  M  ·  · ')).toEqual([
      { label: 'Sizes', values: ['S', 'M'] },
    ]);
  });

  it('returns empty array for empty input', () => {
    expect(parseOptions('')).toEqual([]);
  });
});

describe('buildOrderMessage', () => {
  const base = {
    productName: 'Leather Jacket',
    shopName: 'Vogue Boutique',
    price: 1350,
    productUrl: 'https://seyon.example/store/vogue/leather-jacket',
  };

  it('includes selected options with labels', () => {
    const msg = buildOrderMessage({ ...base, inStock: true, selections: { Sizes: 'M', Colors: 'Red' } });
    expect(msg).toContain('Leather Jacket (Sizes: M, Colors: Red)');
    expect(msg).toContain('₹1350.00');
    expect(msg).toContain(base.productUrl);
  });

  it('renders unnamed-group selections without a label prefix', () => {
    const msg = buildOrderMessage({ ...base, inStock: true, selections: { _: 'Medium' } });
    expect(msg).toContain('Leather Jacket (Medium)');
  });

  it('omits parentheses when nothing is selected', () => {
    const msg = buildOrderMessage({ ...base, inStock: true, selections: {} });
    expect(msg).toContain('order: Leather Jacket —');
    expect(msg).not.toContain('()');
  });

  it('sends a back-in-stock inquiry when sold out', () => {
    const msg = buildOrderMessage({ ...base, inStock: false, selections: {} });
    expect(msg).toContain('sold out');
    expect(msg).toContain('back in stock');
    expect(msg).toContain(base.productUrl);
  });
});
