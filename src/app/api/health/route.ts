import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/backend/lib/logger';
import { createHash } from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * Health check for uptime monitoring (UptimeRobot, BetterStack, Vercel checks).
 * Verifies the app is serving AND the database is reachable.
 */
export async function GET() {
  const dbUrlHash = process.env.DATABASE_URL
    ? createHash('sha256').update(process.env.DATABASE_URL).digest('hex')
    : null;
  const supabaseUrlHash = process.env.SUPABASE_URL
    ? createHash('sha256').update(process.env.SUPABASE_URL).digest('hex')
    : null;

  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: 'ok',
      db: 'up',
      timestamp: new Date().toISOString(),
      dbUrlHash,
      supabaseUrlHash,
    });
  } catch (error) {
    logger.error('Health check failed: database unreachable', error);
    return NextResponse.json(
      {
        status: 'degraded',
        db: 'down',
        timestamp: new Date().toISOString(),
        dbUrlHash,
        supabaseUrlHash,
      },
      { status: 503 }
    );
  }
}

