import { db } from '@/lib/db';
import { AnalyticsEventType } from '@prisma/client';
import { z } from 'zod';

const IdParamSchema = z.string().cuid('Invalid identifier format');
const EventTypeSchema = z.nativeEnum(AnalyticsEventType);

export async function trackEventInternal(shopId: string, eventType: AnalyticsEventType, productId?: string) {
  try {
    const parsedShopId = IdParamSchema.safeParse(shopId);
    if (!parsedShopId.success) {
      return { error: 'Invalid shop ID format' };
    }

    const parsedEventType = EventTypeSchema.safeParse(eventType);
    if (!parsedEventType.success) {
      return { error: 'Invalid event type' };
    }

    let cleanProductId: string | null = null;
    if (productId) {
      const parsedProductId = IdParamSchema.safeParse(productId);
      if (!parsedProductId.success) {
        return { error: 'Invalid product ID format' };
      }
      cleanProductId = parsedProductId.data;
    }

    const analytics = await db.analytics.create({
      data: {
        shopId: parsedShopId.data,
        productId: cleanProductId,
        eventType: parsedEventType.data,
      },
    });

    return { success: true, id: analytics.id };
  } catch (error) {
    console.error('Error logging traffic analytics:', error);
    return { error: 'Failed to record click metric' };
  }
}
