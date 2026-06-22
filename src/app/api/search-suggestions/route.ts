import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
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
