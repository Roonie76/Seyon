import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock @upstash/redis — always succeeds (we aren't testing Redis itself)
vi.mock('@upstash/redis', () => ({
  Redis: class MockRedis {
    constructor() {}
  },
}));

// Mock @upstash/ratelimit — controllable throw behavior
let shouldThrow = false;
vi.mock('@upstash/ratelimit', () => {
  return {
    Ratelimit: class MockRatelimit {
      constructor() {}
      limit = async () => {
        if (shouldThrow) {
          throw new Error('Upstash Redis connection timeout');
        }
        return { success: true, remaining: 5, reset: Date.now() + 60000 };
      };
      static slidingWindow() {
        return 'sliding-window-config';
      }
    },
  };
});

// Mock logger to suppress output and allow assertions
vi.mock('../src/backend/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { rateLimit, RATE_LIMITS, _clearRateLimitStore } from '../src/backend/lib/rate-limit';
import { logger } from '../src/backend/lib/logger';

describe('rateLimit (sliding window)', () => {
  beforeEach(() => {
    _clearRateLimitStore();
    shouldThrow = false;
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  // ── In-memory fallback tests (no env vars set → local limiter) ─────

  it('allows requests under the limit', async () => {
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) {
      const res = await rateLimit('user:1', 5, 60_000, now + i * 100);
      expect(res.success).toBe(true);
    }
  });

  it('blocks the request that exceeds the limit', async () => {
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) {
      await rateLimit('user:1', 5, 60_000, now + i * 100);
    }
    const blocked = await rateLimit('user:1', 5, 60_000, now + 500);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('reports remaining attempts correctly', async () => {
    const now = 1_000_000;
    expect((await rateLimit('user:2', 3, 60_000, now)).remaining).toBe(2);
    expect((await rateLimit('user:2', 3, 60_000, now + 1)).remaining).toBe(1);
    expect((await rateLimit('user:2', 3, 60_000, now + 2)).remaining).toBe(0);
  });

  it('allows requests again after the window slides past old hits', async () => {
    const now = 1_000_000;
    const windowMs = 60_000;
    for (let i = 0; i < 5; i++) {
      await rateLimit('user:3', 5, windowMs, now + i);
    }
    expect((await rateLimit('user:3', 5, windowMs, now + 10)).success).toBe(false);
    // Just past the window of the first hit
    expect((await rateLimit('user:3', 5, windowMs, now + windowMs + 1)).success).toBe(true);
  });

  it('tracks keys independently', async () => {
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) {
      await rateLimit('user:a', 5, 60_000, now + i);
    }
    expect((await rateLimit('user:a', 5, 60_000, now + 10)).success).toBe(false);
    expect((await rateLimit('user:b', 5, 60_000, now + 10)).success).toBe(true);
  });

  it('retryAfterSeconds reflects when the oldest hit expires', async () => {
    const now = 1_000_000;
    const windowMs = 60_000;
    await rateLimit('user:4', 1, windowMs, now);
    const blocked = await rateLimit('user:4', 1, windowMs, now + 30_000);
    expect(blocked.success).toBe(false);
    // Oldest hit expires in 30s
    expect(blocked.retryAfterSeconds).toBe(30);
  });

  // ── Redis failure → fallback test ──────────────────────────────────
  // Stubs env vars so getRedis() creates a real (mocked) Redis instance,
  // which means getRateLimiter() returns a Ratelimit whose .limit() throws.
  // This ONLY passes because the try/catch in rateLimit() catches the error
  // and falls through to localRateLimit(). Remove the try/catch and this
  // test fails with "Upstash Redis connection timeout" — that's the proof.

  it('catches Redis .limit() errors and falls back to localRateLimit', async () => {
    // Arrange: stub env so the lazy getter actually creates a Redis client
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://fake-redis.upstash.io');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'fake-token');
    shouldThrow = true;

    // Act: first call should succeed (via localRateLimit fallback)
    const first = await rateLimit('redis-fail:1', 1, 60_000);
    expect(first.success).toBe(true);

    // Assert: logger.error was called with the tagged message
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('RATE_LIMIT_REDIS_FALLBACK'),
      expect.any(Error),
      expect.objectContaining({ key: 'redis-fail:1', prefix: 'redis-fail' })
    );

    // Act: second call with same key should be blocked by localRateLimit
    const second = await rateLimit('redis-fail:1', 1, 60_000);
    expect(second.success).toBe(false);
    expect(second.retryAfterSeconds).toBeGreaterThan(0);
  });

  // ── Policy values ──────────────────────────────────────────────────

  it('exposes sane policy values in RATE_LIMITS', () => {
    expect(RATE_LIMITS.LOGIN.limit).toBeGreaterThan(0);
    expect(RATE_LIMITS.LOGIN.windowMs).toBe(60_000);
    expect(RATE_LIMITS.REVIEW_CREATE.windowMs).toBe(86_400_000);
    expect(RATE_LIMITS.UPLOAD.limit).toBe(20);
    expect(RATE_LIMITS.SUGGESTIONS.limit).toBe(30);
    expect(RATE_LIMITS.SUGGESTIONS.windowMs).toBe(60_000);
  });
});
