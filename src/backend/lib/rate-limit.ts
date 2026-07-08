/**
 * In-memory sliding-window rate limiter.
 *
 * Scope: per server instance. On serverless/multi-instance deployments each
 * instance keeps its own counters, so real-world limits are (limit x instances).
 * That still blunts brute-force and spam. For exact global limits, swap the
 * Map for Upstash Redis — the function signature is designed to stay the same.
 */

const WINDOWS = new Map<string, number[]>();
const MAX_TRACKED_KEYS = 10_000;

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  /** Seconds until the next attempt is allowed (0 when success). */
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): RateLimitResult {
  const cutoff = now - windowMs;
  const previous = WINDOWS.get(key);
  const hits = previous ? previous.filter((t) => t > cutoff) : [];

  if (hits.length >= limit) {
    WINDOWS.set(key, hits);
    const retryAfterMs = hits[0] + windowMs - now;
    return {
      success: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  hits.push(now);
  // Refresh insertion order so the oldest-used keys are evicted first.
  WINDOWS.delete(key);
  WINDOWS.set(key, hits);

  if (WINDOWS.size > MAX_TRACKED_KEYS) {
    const oldestKey = WINDOWS.keys().next().value;
    if (oldestKey !== undefined) WINDOWS.delete(oldestKey);
  }

  return {
    success: true,
    remaining: limit - hits.length,
    retryAfterSeconds: 0,
  };
}

/** Central registry of limits so policies live in one place. */
export const RATE_LIMITS = {
  /** Credentials sign-in attempts, keyed by email. */
  LOGIN: { limit: 5, windowMs: 60_000 },
  /** Image uploads, keyed by user id. */
  UPLOAD: { limit: 20, windowMs: 3_600_000 },
  /** Reviews created, keyed by user id. */
  REVIEW_CREATE: { limit: 3, windowMs: 86_400_000 },
  /** Reports filed, keyed by user id. */
  REPORT_CREATE: { limit: 5, windowMs: 86_400_000 },
  /** Shops created, keyed by user id. */
  SHOP_CREATE: { limit: 3, windowMs: 86_400_000 },
  /** Products created, keyed by user id. */
  PRODUCT_CREATE: { limit: 60, windowMs: 86_400_000 },
  /** WhatsApp verification code requests, keyed by shop id. */
  WHATSAPP_VERIFY_REQUEST: { limit: 3, windowMs: 3_600_000 },
  /** WhatsApp verification code attempts, keyed by shop id. */
  WHATSAPP_VERIFY_CONFIRM: { limit: 6, windowMs: 3_600_000 },
  /** Cart validation requests, keyed by IP address. */
  CART_VALIDATE: { limit: 30, windowMs: 60_000 },
} as const;

/** Test-only helper to reset state between test cases. */
export function _clearRateLimitStore(): void {
  WINDOWS.clear();
}
