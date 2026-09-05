'use server';

import { getSession } from '@/backend/lib/session';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { logger } from '../lib/logger';

export async function toggleWishlistItem(productId: string) {
  const session = await getSession();
  if (!session || !session.user || !session.user.id) {
    return { success: false, error: 'Unauthorized. Please log in first.' };
  }

  const userId = session.user.id;

  try {
    // Check if item is already in wishlist
    const existing = await db.wishlist.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });

    if (existing) {
      // Remove it
      await db.wishlist.delete({
        where: {
          id: existing.id,
        },
      });
      revalidatePath('/wishlist');
      revalidatePath('/marketplace');
      return { success: true, added: false };
    } else {
      // Add it
      await db.wishlist.create({
        data: {
          userId,
          productId,
        },
      });
      revalidatePath('/wishlist');
      revalidatePath('/marketplace');
      return { success: true, added: true };
    }
  } catch (error) {
    logger.error('Error in toggleWishlistItem', error);
    return { success: false, error: 'Failed to update wishlist.' };
  }
}

export async function getWishlistProducts() {
  const session = await getSession();
  if (!session || !session.user || !session.user.id) {
    return { success: false, error: 'Unauthorized.' };
  }

  try {
    const items = await db.wishlist.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        product: {
          include: {
            images: { orderBy: { displayOrder: 'asc' }, take: 1 },
            shop: { select: { name: true, slug: true, isVerified: true } },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const products = items.map(item => item.product);
    return { success: true, products };
  } catch (error) {
    logger.error('Error in getWishlistProducts', error);
    return { success: false, error: 'Failed to fetch wishlist products.' };
  }
}

export async function getWishlistCount() {
  const session = await getSession();
  if (!session || !session.user || !session.user.id) {
    return 0;
  }

  try {
    const count = await db.wishlist.count({
      where: {
        userId: session.user.id,
      },
    });
    return count;
  } catch (error) {
    logger.error('Error in getWishlistCount', error);
    return 0;
  }
}

export async function isProductWishlisted(productId: string) {
  const session = await getSession();
  if (!session || !session.user || !session.user.id) {
    return false;
  }

  try {
    const existing = await db.wishlist.findUnique({
      where: {
        userId_productId: {
          userId: session.user.id,
          productId,
        },
      },
    });
    return !!existing;
  } catch (error) {
    logger.error('Error in isProductWishlisted', error);
    return false;
  }
}
