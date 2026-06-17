import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ categories: [], shops: [], products: [] });
    }

    const trimmedQuery = query.trim();

    // Query categories, shops, and products matching the query in parallel
    const [categoriesRaw, shops, products] = await Promise.all([
      db.product.findMany({
        where: {
          status: 'ACTIVE',
          shop: { isSuspended: false, isPaused: false },
          category: { contains: trimmedQuery, mode: 'insensitive' },
        },
        select: { category: true },
        distinct: ['category'],
        take: 3,
      }),
      db.shop.findMany({
        where: {
          isSuspended: false,
          isPaused: false,
          name: { contains: trimmedQuery, mode: 'insensitive' },
        },
        select: { name: true, slug: true },
        take: 3,
      }),
      db.product.findMany({
        where: {
          status: 'ACTIVE',
          shop: { isSuspended: false, isPaused: false },
          title: { contains: trimmedQuery, mode: 'insensitive' },
        },
        select: {
          id: true,
          title: true,
          slug: true,
          price: true,
          shop: {
            select: {
              slug: true,
            },
          },
        },
        take: 5,
      }),
    ]);

    const categories = categoriesRaw.map((p) => p.category);

    return NextResponse.json({
      categories,
      shops,
      products,
    });
  } catch (error) {
    console.error('Error fetching search suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch search suggestions' },
      { status: 500 }
    );
  }
}
