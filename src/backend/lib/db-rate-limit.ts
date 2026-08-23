import { db } from '@/lib/db';
import { logger } from './logger';

/**
 * Rate limiting backed by Postgres.
 *
 * This exists so the limiter works correctly with no extra infrastructure.
 * The previous fallback was a per-process in-memory Map: on Vercel every warm
 * instance kept its own tally, so "5 login attempts per minute" was really
 * 5 × however many instances were warm, and it reset on every cold start. The
 * limits were decorative in exactly the environment where they matter.
 *
 * The database is already shared by every instance, so it can hold the
 * counters. A fixed window is used rather than a sliding log: one upserted row
 * per key per window, which is a single round trip and self-expiring. It
 * allows at most 2× the limit across a window boundary, which is the standard
 * and acceptable trade for the simplicity.
 *
 * Upstash remains the preferred backend when configured — it is faster and
 * keeps this load off Postgres. This is what runs when it is not.
 */

export interface DbRateLimitResult {
  success: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/** Rows are cleaned opportunistically; this bounds how often we bother. */
let lastSweep = 0;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

async function sweepExpired(now: number): Promise<void> {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  try {
    await db.rateLimitCounter.deleteMany({ where: { expiresAt: { lt: new Date(now) } } });
  } catch (err) {
    logger.warn('Rate limit sweep failed', {
      reason: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function dbRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): Promise<DbRateLimitResult> {
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const windowKey = `${key}:${windowStart}`;
  const expiresAt = new Date(windowStart + windowMs);

  // Increment and read back in one statement. ON CONFLICT makes this atomic
  // under concurrency, which a read-then-write pair would not be.
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimitCounter" ("key", "count", "expiresAt")
    VALUES (${windowKey}, 1, ${expiresAt})
    ON CONFLICT ("key") DO UPDATE
      SET "count" = "RateLimitCounter"."count" + 1
    RETURNING "count"
  `;

  const count = rows[0]?.count ?? 1;

  void sweepExpired(now);

  if (count > limit) {
    return {
      success: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000)),
    };
  }

  return { success: true, remaining: Math.max(0, limit - count), retryAfterSeconds: 0 };
}
