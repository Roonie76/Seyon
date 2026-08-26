import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rateLimit, RATE_LIMITS } from '@/backend/lib/rate-limit';

export async function GET(req: NextRequest) {
  const ip =
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',').pop()?.trim() ||
    'unknown';

  const rl = await rateLimit(
    `suggestions:${ip}`,
    RATE_LIMITS.SUGGESTIONS.limit,
    RATE_LIMITS.SUGGESTIONS.windowMs
  );
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    );
  }

  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const matches = await db.product.findMany({
      where: {
        status: 'ACTIVE',
        title: { contains: q, mode: 'insensitive' },
      },
      select: { title: true },
      take: 6,
      distinct: ['title'],
    });

    return NextResponse.json({ suggestions: matches.map((m) => m.title) });
  } catch (error) {
    console.error('Error fetching search suggestions:', error);
    return NextResponse.json({ suggestions: [] }, { status: 500 });
  }
}
