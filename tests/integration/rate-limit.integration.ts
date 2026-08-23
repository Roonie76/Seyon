import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { testDb, closeDatabase } from './setup';
import { dbRateLimit } from '@/backend/lib/db-rate-limit';

/**
 * The Postgres-backed limiter is what runs in production when Upstash is not
 * configured. It has to behave correctly under concurrency, because the whole
 * point is that several serverless instances share one counter.
 */

beforeAll(async () => {
  await testDb.$connect();
});

beforeEach(async () => {
  await testDb.rateLimitCounter.deleteMany({});
});

afterAll(async () => {
  await closeDatabase();
});

const WINDOW = 60_000;

describe('database-backed rate limiting', () => {
  it('allows up to the limit and refuses beyond it', async () => {
    const now = Date.now();
    const results = [];
    for (let i = 0; i < 6; i++) {
      results.push(await dbRateLimit('login:someone@example.com', 5, WINDOW, now));
    }

    expect(results.slice(0, 5).every((r) => r.success)).toBe(true);
    expect(results[5].success).toBe(false);
    expect(results[5].retryAfterSeconds).toBeGreaterThan(0);
  });

  it('counts a shared key across concurrent callers exactly once each', async () => {
    // This is the property the in-memory fallback could not provide: two
    // serverless instances hitting the same key must share one tally.
    const now = Date.now();
    const attempts = await Promise.all(
      Array.from({ length: 10 }, () => dbRateLimit('upload:user-1', 4, WINDOW, now))
    );

    const allowed = attempts.filter((r) => r.success).length;
    expect(allowed).toBe(4);
    expect(attempts.filter((r) => !r.success)).toHaveLength(6);
  });

  it('keeps separate subjects independent', async () => {
    const now = Date.now();
    for (let i = 0; i < 5; i++) await dbRateLimit('login:a@example.com', 5, WINDOW, now);

    const other = await dbRateLimit('login:b@example.com', 5, WINDOW, now);
    expect(other.success).toBe(true);
  });

  it('starts a fresh allowance in the next window', async () => {
    const now = Date.now();
    for (let i = 0; i < 5; i++) await dbRateLimit('review:user-1', 5, WINDOW, now);
    expect((await dbRateLimit('review:user-1', 5, WINDOW, now)).success).toBe(false);

    const nextWindow = now + WINDOW;
    expect((await dbRateLimit('review:user-1', 5, WINDOW, nextWindow)).success).toBe(true);
  });

  it('reports a retry-after that lands inside the window', async () => {
    const now = Date.now();
    await dbRateLimit('cart-validate:1.2.3.4', 1, WINDOW, now);
    const blocked = await dbRateLimit('cart-validate:1.2.3.4', 1, WINDOW, now);

    expect(blocked.success).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(WINDOW / 1000);
  });

  it('writes one row per key per window, not one per request', async () => {
    const now = Date.now();
    for (let i = 0; i < 8; i++) await dbRateLimit('suggestions:9.9.9.9', 100, WINDOW, now);

    const rows = await testDb.rateLimitCounter.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(8);
  });
});
