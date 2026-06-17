import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../src/app/api/search/suggestions/route';
import { NextRequest } from 'next/server';

const mockProductFindMany = vi.fn();
const mockShopFindMany = vi.fn();

vi.mock('../src/backend/lib/db', () => ({
  db: {
    product: { findMany: (...args: unknown[]) => mockProductFindMany(...args) },
    shop: { findMany: (...args: unknown[]) => mockShopFindMany(...args) },
  },
}));

describe('/api/search/suggestions API route', () => {
  beforeEach(() => {
    mockProductFindMany.mockReset();
    mockShopFindMany.mockReset();
  });

  it('returns empty lists if no query is provided', async () => {
    const req = new NextRequest('http://localhost:3000/api/search/suggestions');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ categories: [], shops: [], products: [] });
    expect(mockProductFindMany).not.toHaveBeenCalled();
  });

  it('returns empty lists if query is shorter than 2 characters', async () => {
    const req = new NextRequest('http://localhost:3000/api/search/suggestions?q=a');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ categories: [], shops: [], products: [] });
    expect(mockProductFindMany).not.toHaveBeenCalled();
  });

  it('queries DB and formats matching categories, shops, and products', async () => {
    // Mock categories findMany (first call to product.findMany)
    mockProductFindMany.mockResolvedValueOnce([
      { category: 'Fashion' },
      { category: 'Food & Beverages' },
    ]);

    // Mock shops findMany
    mockShopFindMany.mockResolvedValueOnce([
      { name: 'Vogue Boutique', slug: 'vogue-boutique' },
    ]);

    // Mock products findMany (second call to product.findMany)
    mockProductFindMany.mockResolvedValueOnce([
      { id: 'p1', title: 'Vintage Leather Jacket', slug: 'vintage-leather', price: 1200, shop: { slug: 'vogue-boutique' } },
    ]);

    const req = new NextRequest('http://localhost:3000/api/search/suggestions?q=vintage');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.categories).toEqual(['Fashion', 'Food & Beverages']);
    expect(data.shops).toEqual([
      { name: 'Vogue Boutique', slug: 'vogue-boutique' },
    ]);
    expect(data.products).toEqual([
      { id: 'p1', title: 'Vintage Leather Jacket', slug: 'vintage-leather', price: 1200, shop: { slug: 'vogue-boutique' } },
    ]);

    expect(mockProductFindMany).toHaveBeenCalledTimes(2);
    expect(mockShopFindMany).toHaveBeenCalledTimes(1);
  });

  it('returns status 550 if query errors out', async () => {
    mockProductFindMany.mockRejectedValue(new Error('Prisma database failure'));

    const req = new NextRequest('http://localhost:3000/api/search/suggestions?q=error');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe('Failed to fetch search suggestions');
  });
});
