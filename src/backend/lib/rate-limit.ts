/**
 * Serverless-safe rate limiter with Upstash Redis backend.
 *
 * When UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are configured,
 * rate limits are enforced via a shared Redis sliding-window counter (global
 * across all Vercel instances). When credentials are missing or Redis errors
 * out, falls back to the original in-memory Map sliding-window limiter.
 *
 * Backend order:
 *  1. Upstash Redis when configured — fastest, keeps load off Postgres
 *  2. Postgres otherwise — shared across every instance, so the limits are
 *     real without any extra infrastructure
 *  3. In-memory only in dev/test, where a single process is the whole world
 *
 * Step 2 is the important one. The in-memory Map used to be the only
 * fallback, and on Vercel each warm instance kept its own tally — so a limit
 * of 5/minute was really 5 × the number of warm instances, reset on every cold
 * start. Nothing in production should depend on that.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { logger } from './logger';
import { dbRateLimit } from './db-rate-limit';

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  /** Seconds until the next attempt is allowed (0 when success). */
  retryAfterSeconds: number;
}

// --- In-Memory fallback rate limiter (original implementation) ---
const WINDOWS = new Map<string, number[]>();
const MAX_TRACKED_KEYS = 10_000;

function localRateLimit(
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

// --- Upstash Redis Serverless rate limiter (lazy initialization) ---
let _redis: Redis | null | undefined; // undefined = not yet initialized
let _prodWarningEmitted = false;

function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    _redis = new Redis({ url, token });
  } else {
    _redis = null;
    if (process.env.NODE_ENV === 'production' && !_prodWarningEmitted) {
      _prodWarningEmitted = true;
      logger.warn(
        'Upstash Redis is not configured (UPSTASH_REDIS_REST_URL/TOKEN). ' +
        'Rate limiting is using the Postgres backend, which is correct across ' +
        'instances but adds a write per limited request. Configure Upstash to ' +
        'move that load off the database.'
      );
    }
  }

  return _redis;
}

const ratelimiters = new Map<string, Ratelimit>();

function getRateLimiter(prefix: string, limit: number, windowMs: number): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  // Scoped cache key prevents collision if the same prefix
  // is ever reused with different limit/windowMs config
  const cacheKey = `${prefix}:${limit}:${windowMs}`;
  let limiter = ratelimiters.get(cacheKey);
  if (!limiter) {
    const durationString = `${Math.ceil(windowMs / 1000)} s`;
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, durationString as Parameters<typeof Ratelimit.slidingWindow>[1]),
      prefix: `seyon:ratelimit:${prefix}`,
    });
    ratelimiters.set(cacheKey, limiter);
  }
  return limiter;
}

/**
 * Single-process memory is only trustworthy where there is only one process.
 * Anywhere else, fall through to the database.
 */
function shouldUseMemoryFallback(): boolean {
  return process.env.NODE_ENV !== 'production';
}

export interface RateLimitOptions {
  /**
   * Refuse the call when the limiter itself is broken, instead of degrading to
   * per-instance memory.
   *
   * The default is to fail open, and for view tracking or search suggestions
   * that is the right trade: a limiter outage should not take down the feature
   * it protects. It is the wrong trade for anything guarding a secret. The
   * in-memory fallback counts per warm instance and resets on cold start, and
   * the per-row attempt counter on a verification code resets whenever a new
   * code is requested — so under a database incident, fail-open means code
   * guessing is effectively uncapped. Denying the attempt is the lesser harm
   * there: the seller retries in a minute, and nobody brute-forces anything.
   */
  failClosed?: boolean;
  /**
   * How many tokens this one call consumes. Defaults to 1.
   *
   * Quick Add creates up to twelve products in a single call and charged one
   * token for the batch, turning a 60-per-day cap into 720.
   */
  cost?: number;
}

async function fallbackRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number,
  failClosed: boolean
): Promise<RateLimitResult> {
  if (shouldUseMemoryFallback()) {
    return localRateLimit(key, limit, windowMs, now);
  }

  try {
    return await dbRateLimit(key, limit, windowMs, now);
  } catch (err) {
    // A limiter that throws must not take down the request it is protecting.
    // Failing open is the lesser evil for view tracking and search
    // suggestions; the error is loud so it does not pass unnoticed.
    logger.error('RATE_LIMIT_DB_FAILED: database rate limiter unavailable', err, {
      key,
      limit,
      windowMs,
      failClosed,
    });
    if (failClosed) {
      return { success: false, remaining: 0, retryAfterSeconds: 60 };
    }
    return localRateLimit(key, limit, windowMs, now);
  }
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const failClosed = options.failClosed ?? false;
  const cost = Math.max(1, Math.floor(options.cost ?? 1));
  const prefix = key.split(':')[0] || 'default';
  const limiter = getRateLimiter(prefix, limit, windowMs);

  if (!limiter) {
    return chargeFallback(key, limit, windowMs, now, failClosed, cost);
  }

  try {
    // `limit()` spends one token, so a batch spends one per item. Stop at the
    // first refusal and report it, rather than charging the rest anyway.
    let last = await limiter.limit(key);
    for (let i = 1; i < cost && last.success; i += 1) {
      last = await limiter.limit(key);
    }
    return {
      success: last.success,
      remaining: last.remaining,
      retryAfterSeconds: last.success
        ? 0
        : Math.max(1, Math.ceil((last.reset - Date.now()) / 1000)),
    };
  } catch (err) {
    logger.error(
      'RATE_LIMIT_REDIS_FALLBACK: Redis rate limiter failed, falling back',
      err,
      { key, prefix, limit, windowMs }
    );
    return chargeFallback(key, limit, windowMs, now, failClosed, cost);
  }
}

/** Spend `cost` tokens against the fallback limiter, stopping at the first refusal. */
async function chargeFallback(
  key: string,
  limit: number,
  windowMs: number,
  now: number,
  failClosed: boolean,
  cost: number
): Promise<RateLimitResult> {
  let result = await fallbackRateLimit(key, limit, windowMs, now, failClosed);
  for (let i = 1; i < cost && result.success; i += 1) {
    result = await fallbackRateLimit(key, limit, windowMs, now, failClosed);
  }
  return result;
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
  /** Search suggestions autocomplete endpoints, keyed by IP. */
  SUGGESTIONS: { limit: 30, windowMs: 60_000 },
  /** Public analytics events (views, WhatsApp taps), keyed by IP. */
  ANALYTICS_EVENT: { limit: 60, windowMs: 60_000 },
  /**
   * Data-export requests, keyed by user id. A legal right, so the limit is
   * generous — but the query is expensive and reads everything about a person,
   * so it should not be loopable.
   */
  ACCOUNT_EXPORT: { limit: 5, windowMs: 86_400_000 },
  /**
   * Identity submissions, keyed by user id. Low on purpose: each one costs a
   * reviewer's time, and a seller resubmitting ten times in an hour is either
   * confused or probing.
   */
  KYC_SUBMIT: { limit: 5, windowMs: 3_600_000 },
  /**
   * Store profile saves, keyed by user id. The rename endpoint sat next to a
   * 3-per-day create limit with no limit of its own, which is what made
   * walking a wordlist of desirable handles cheap — and each save purges
   * twelve cache tags.
   */
  SHOP_UPDATE: { limit: 30, windowMs: 3_600_000 },
  /**
   * Changes to the storefront address specifically. A legitimate seller does
   * this once, maybe twice, ever; anyone doing it repeatedly is hunting for
   * handles, and every change strands the links they last shared.
   */
  SHOP_SLUG_CHANGE: { limit: 3, windowMs: 30 * 86_400_000 },
  /** Any privileged admin action, keyed by admin id. A stolen session should not be able to suspend the whole marketplace. */
  ADMIN_ACTION: { limit: 120, windowMs: 60_000 },
} as const;

/** Test-only: reset in-memory state and force lazy Redis re-evaluation. */
export function _clearRateLimitStore(): void {
  WINDOWS.clear();
  ratelimiters.clear();
  _redis = undefined;
  _prodWarningEmitted = false;
}
