'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ReportSchema } from '@/lib/zod-schemas';
import { rateLimit, RATE_LIMITS } from '../lib/rate-limit';
import { revalidatePath } from 'next/cache';
import { logger } from '../lib/logger';
import { revalidateShopSurface } from '@/shared/lib/cache';

export async function createReport(shopId: string, rawData: unknown) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return { error: 'You must be logged in to file a report' };
    }

    const userId = session.user.id;
    if (!userId) {
      return { error: 'User ID not found in session' };
    }

    const rl = await rateLimit(`report:${userId}`, RATE_LIMITS.REPORT_CREATE.limit, RATE_LIMITS.REPORT_CREATE.windowMs);
    if (!rl.success) {
      return { error: 'You have filed too many reports today. Please try again later.' };
    }

    // Verify shop exists
    const shop = await db.shop.findUnique({
      where: { id: shopId },
    });

    if (!shop) {
      return { error: 'Shop not found' };
    }

    const validated = ReportSchema.safeParse(rawData);
    if (!validated.success) {
      return { error: validated.error.issues[0].message };
    }

    const report = await db.report.create({
      data: {
        shopId,
        userId,
        category: validated.data.category,
        reason: validated.data.reason,
      },
    });

    revalidateShopSurface(shop.slug);
    revalidatePath('/admin');
    return { success: true, report };
  } catch (error) {
    logger.error('Error creating report', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return { error: errorMessage };
  }
}
