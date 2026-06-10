import { describe, it, expect, beforeEach } from 'vitest';
import { rateLimit, RATE_LIMITS, _clearRateLimitStore } from '../src/backend/lib/rate-limit';

describe('rateLimit (sliding window)', () => {
  beforeEach(() => {
    _clearRateLimitStore();
  });

  it('allows requests under the limit', () => {
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) {
      const res = rateLimit('user:1', 5, 60_000, now + i * 100);
      expect(res.success).toBe(true);
    }
  });

  it('blocks the request that exceeds the limit', () => {
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) {
      rateLimit('user:1', 5, 60_000, now + i * 100);
    }
    const blocked = rateLimit('user:1', 5, 60_000, now + 500);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('reports remaining attempts correctly', () => {
    const now = 1_000_000;
    expect(rateLimit('user:2', 3, 60_000, now).remaining).toBe(2);
    expect(rateLimit('user:2', 3, 60_000, now + 1).remaining).toBe(1);
    expect(rateLimit('user:2', 3, 60_000, now + 2).remaining).toBe(0);
  });

  it('allows requests again after the window slides past old hits', () => {
    const now = 1_000_000;
    const windowMs = 60_000;
    for (let i = 0; i < 5; i++) {
      rateLimit('user:3', 5, windowMs, now + i);
    }
    expect(rateLimit('user:3', 5, windowMs, now + 10).success).toBe(false);
    // Just past the window of the first hit
    expect(rateLimit('user:3', 5, windowMs, now + windowMs + 1).success).toBe(true);
  });

  it('tracks keys independently', () => {
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) {
      rateLimit('user:a', 5, 60_000, now + i);
    }
    expect(rateLimit('user:a', 5, 60_000, now + 10).success).toBe(false);
    expect(rateLimit('user:b', 5, 60_000, now + 10).success).toBe(true);
  });

  it('retryAfterSeconds reflects when the oldest hit expires', () => {
    const now = 1_000_000;
    const windowMs = 60_000;
    rateLimit('user:4', 1, windowMs, now);
    const blocked = rateLimit('user:4', 1, windowMs, now + 30_000);
    expect(blocked.success).toBe(false);
    // Oldest hit expires in 30s
    expect(blocked.retryAfterSeconds).toBe(30);
  });

  it('exposes sane policy values in RATE_LIMITS', () => {
    expect(RATE_LIMITS.LOGIN.limit).toBeGreaterThan(0);
    expect(RATE_LIMITS.LOGIN.windowMs).toBe(60_000);
    expect(RATE_LIMITS.REVIEW_CREATE.windowMs).toBe(86_400_000);
    expect(RATE_LIMITS.UPLOAD.limit).toBe(20);
  });
});
