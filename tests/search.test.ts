import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQueryRaw = vi.fn();

vi.mock('../src/backend/lib/db', () => ({
  db: { $queryRaw: (...args: unknown[]) => mockQueryRaw(...args) },
}));

import { searchProductIds } from '../src/backend/lib/search';

describe('searchProductIds', () => {
  beforeEach(() => {
    mockQueryRaw.mockReset();
  });

  it('returns ordered ids and total from the window count', async () => {
    mockQueryRaw.mockResolvedValue([
      { id: 'p2', total: BigInt(3) },
      { id: 'p1', total: BigInt(3) },
      { id: 'p3', total: BigInt(3) },
    ]);

    const res = await searchProductIds({ query: 'leather jacket' });

    expect(res.ids).toEqual(['p2', 'p1', 'p3']);
    expect(res.total).toBe(3);
  });

  it('returns empty result when nothing matches', async () => {
    mockQueryRaw.mockResolvedValue([]);

    const res = await searchProductIds({ query: 'zzz-no-match' });

    expect(res.ids).toEqual([]);
    expect(res.total).toBe(0);
  });

  it('embeds the query, filters, and pagination as bound parameters', async () => {
    mockQueryRaw.mockResolvedValue([]);

    await searchProductIds({
      query: 'mug',
      category: 'Home & Living',
      minPrice: 10,
      maxPrice: 100,
      sort: 'price-asc',
      page: 3,
      perPage: 8,
    });

    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    const sqlArg = mockQueryRaw.mock.calls[0][0] as { values: unknown[]; sql?: string; strings?: string[] };
    // All user inputs must be parameterized, never interpolated
    expect(sqlArg.values).toContain('mug');
    expect(sqlArg.values).toContain('%mug%');
    expect(sqlArg.values).toContain('Home & Living');
    expect(sqlArg.values).toContain(10);
    expect(sqlArg.values).toContain(100);
    expect(sqlArg.values).toContain(16); // offset = (3-1)*8
  });

  it('clamps page numbers below 1 to the first page', async () => {
    mockQueryRaw.mockResolvedValue([]);

    await searchProductIds({ query: 'mug', page: 0, perPage: 8 });

    const sqlArg = mockQueryRaw.mock.calls[0][0] as { values: unknown[] };
    expect(sqlArg.values).toContain(0); // offset clamped to 0
  });

  it('clamps negative price parameters to 0 in SQL inputs', async () => {
    mockQueryRaw.mockResolvedValue([]);

    await searchProductIds({
      query: 'mug',
      minPrice: -10,
      maxPrice: -50,
    });

    const sqlArg = mockQueryRaw.mock.calls[0][0] as { values: unknown[] };
    expect(sqlArg.values).toContain(0);
    expect(sqlArg.values).not.toContain(-10);
    expect(sqlArg.values).not.toContain(-50);
  });
});
