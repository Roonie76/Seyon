import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { runDailyJobs } from '@/backend/lib/scheduled-jobs';
import { logger } from '@/backend/lib/logger';

/**
 * The one scheduled entry point.
 *
 * Authorised by a shared secret rather than a session, because there is no
 * person here. The comparison is constant-time: a naive `===` on a secret
 * leaks its length and, given enough attempts, its content.
 *
 * Refusing is the default. A missing `CRON_SECRET` means the route answers 503
 * rather than running unauthenticated — an endpoint that sweeps identity
 * documents must never be open because a variable was forgotten.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorised(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const expected = `Bearer ${secret}`;
  const given = header ?? '';

  // timingSafeEqual throws on a length mismatch, which would itself be a
  // length oracle. Compare fixed-size digests of both instead.
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  if (a.length !== b.length) {
    // Still do a comparison of equal length, so the work done does not depend
    // on whether the length matched.
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    logger.error('Cron route called with no CRON_SECRET configured');
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  if (!authorised(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const started = Date.now();
  const results = await runDailyJobs();

  logger.info('Daily jobs finished', {
    ms: Date.now() - started,
    results: results.map((r) => `${r.name}:${r.did}`).join(' '),
  });

  return NextResponse.json({ ok: true, results });
}
