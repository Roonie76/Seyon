import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/backend/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Health check for uptime monitoring (UptimeRobot, BetterStack, Vercel checks).
 * Verifies the app is serving AND the database is reachable.
 */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: 'ok',
      db: 'up',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Health check failed: database unreachable', error);
    return NextResponse.json(
      {
        status: 'degraded',
        db: 'down',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}

