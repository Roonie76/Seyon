'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ReportSchema } from '@/lib/zod-schemas';
import { revalidatePath } from 'next/cache';

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
        reason: validated.data.reason,
      },
    });

    revalidatePath(`/store/${shop.slug}`);
    revalidatePath('/admin');
    return { success: true, report };
  } catch (error) {
    console.error('Error creating report:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return { error: errorMessage };
  }
}
