'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Role, AnalyticsEventType } from '@prisma/client';
import { z } from 'zod';

const IdParamSchema = z.string().cuid('Invalid identifier format');
const EventTypeSchema = z.nativeEnum(AnalyticsEventType);

export async function trackEvent(shopId: string, eventType: AnalyticsEventType, productId?: string) {
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

    // Public logging (no auth needed for traffic events)
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

export async function getShopAnalytics(shopId: string) {
  try {
    const parsedShopId = IdParamSchema.safeParse(shopId);
    if (!parsedShopId.success) {
      return { error: 'Invalid shop ID format' };
    }

    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return { error: 'Unauthorized' };
    }

    const shop = await db.shop.findUnique({
      where: { id: parsedShopId.data },
    });

    if (!shop) {
      return { error: 'Shop not found' };
    }

    if (shop.ownerId !== session.user.id && session.user.role !== Role.ADMIN) {
      return { error: 'Access denied' };
    }

    // Aggregate key counts
    const counts = await db.analytics.groupBy({
      by: ['eventType'],
      where: { shopId },
      _count: {
        id: true,
      },
    });

    const metrics = {
      views: 0,
      productViews: 0,
      whatsappClicks: 0,
    };

    counts.forEach((item) => {
      if (item.eventType === AnalyticsEventType.SHOP_VIEW) {
        metrics.views = item._count.id;
      } else if (item.eventType === AnalyticsEventType.PRODUCT_VIEW) {
        metrics.productViews = item._count.id;
      } else if (item.eventType === AnalyticsEventType.WHATSAPP_CLICK) {
        metrics.whatsappClicks = item._count.id;
      }
    });

    // Get time-series views for the past 7 days
    const past7DaysData = [];
    for (let i = 6; i >= 0; i--) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - i);

      const end = new Date();
      end.setHours(23, 59, 59, 999);
      end.setDate(end.getDate() - i);

      const dayViews = await db.analytics.count({
        where: {
          shopId,
          eventType: AnalyticsEventType.SHOP_VIEW,
          createdAt: {
            gte: start,
            lte: end,
          },
        },
      });

      const dayClicks = await db.analytics.count({
        where: {
          shopId,
          eventType: AnalyticsEventType.WHATSAPP_CLICK,
          createdAt: {
            gte: start,
            lte: end,
          },
        },
      });

      const dateString = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      past7DaysData.push({
        date: dateString,
        views: dayViews,
        clicks: dayClicks,
      });
    }

    return {
      success: true,
      metrics,
      chartData: past7DaysData,
    };
  } catch (error) {
    console.error('Error fetching shop analytics:', error);
    return { error: error instanceof Error ? error.message : 'An unexpected error occurred' };
  }
}
