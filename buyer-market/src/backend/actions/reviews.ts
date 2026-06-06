'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ReviewSchema } from '@/lib/zod-schemas';
import { revalidatePath } from 'next/cache';

export async function createReview(shopId: string, rawData: unknown) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return { error: 'You must be logged in to leave a review' };
    }

    const userId = session.user.id;
    if (!userId) {
      return { error: 'User ID not found in session' };
    }

    // Verify shop exists
    const shop = await db.shop.findUnique({
      where: { id: shopId },
    });

    if (!shop) {
      return { error: 'Shop not found' };
    }

    // A seller cannot review their own shop
    if (shop.ownerId === userId) {
      return { error: 'You cannot leave a review for your own shop' };
    }

    const validated = ReviewSchema.safeParse(rawData);
    if (!validated.success) {
      return { error: validated.error.issues[0].message };
    }

    // Check if user has already reviewed this shop
    const existingReview = await db.review.findUnique({
      where: {
        shopId_userId: {
          shopId,
          userId,
        },
      },
    });

    if (existingReview) {
      return { error: 'You have already submitted a review for this storefront' };
    }

    const review = await db.review.create({
      data: {
        shopId,
        userId,
        rating: validated.data.rating,
        comment: validated.data.comment,
      },
      include: {
        user: {
          select: { name: true, image: true },
        },
      },
    });

    revalidatePath(`/store/${shop.slug}`);
    revalidatePath('/dashboard');
    return { success: true, review };
  } catch (error) {
    console.error('Error creating review:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return { error: errorMessage };
  }
}
