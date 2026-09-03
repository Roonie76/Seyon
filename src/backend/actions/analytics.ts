'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isCurrentUserAdmin } from '../lib/is-admin';
import { Role, AnalyticsEventType } from '@prisma/client';
import { z } from 'zod';
import { trackEventInternal, isTrackingAllowed, type TrackResult } from '../lib/analytics';
import { logger } from '../lib/logger';
import { toUserMessage } from '../lib/action-errors';
import { istDayStart, istDayKey, istDayLabel, lastIstDays } from '@/shared/lib/ist';

const IdParamSchema = z.string().cuid('Invalid identifier format');

/** The window the headline metric cards cover, and compare against. */
const METRIC_WINDOW_DAYS = 30;
/** How many days the chart shows. */
const CHART_DAYS = 7;

export async function trackEvent(
  shopId: string,
  eventType: AnalyticsEventType,
  productId?: string
): Promise<TrackResult> {
  // This action is reachable by anyone, so it is rate-limited per IP and bots
  // are dropped before anything is written. Without that, a seller's dashboard
  // numbers — and the WHATSAPP_CLICK rows the review gate reads — could be
  // manufactured at will.
  if (!(await isTrackingAllowed())) {
    return { success: true, skipped: 'rate-limited' as const };
  }

  // Attribute the event to the signed-in user when available. This powers
  // review gating: only buyers who actually contacted a seller may review them.
  let userId: string | null = null;
  try {
    const session = await auth();
    userId = session?.user?.id ?? null;
  } catch {
    // Anonymous tracking is fine
  }
  // WhatsApp taps are the buyer's own deliberate action, so they are recorded
  // every time rather than deduplicated like passive page views.
  return trackEventInternal(shopId, eventType, productId, userId, {
    skipDedupe: eventType === 'WHATSAPP_CLICK',
  });
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

    // The role is re-read from the database, never taken from the JWT claim.
    // `session.user.role` is baked in at sign-in and was, until recently,
    // writable by the client through the session-update endpoint.
    if (shop.ownerId !== session.user.id && !(await isCurrentUserAdmin())) {
      return { error: 'Access denied' };
    }

    /**
     * Two windows, said out loud.
     *
     * These counts had no date filter, so "Store Views" and "Clicks" were
     * lifetime totals sitting directly above a seven-day chart, with no label
     * on either. A seller reading 4,200 views reasonably took it as recent
     * performance; it might have been two years old, and there was no way on
     * the page to tell whether traffic was rising or falling.
     */
    const now = new Date();
    const windowStart = new Date(istDayStart(now).getTime() - (METRIC_WINDOW_DAYS - 1) * 86_400_000);
    const previousStart = new Date(windowStart.getTime() - METRIC_WINDOW_DAYS * 86_400_000);

    const [currentCounts, previousCounts] = await Promise.all([
      db.analytics.groupBy({
        by: ['eventType'],
        where: { shopId, createdAt: { gte: windowStart } },
        _count: { id: true },
      }),
      db.analytics.groupBy({
        by: ['eventType'],
        where: { shopId, createdAt: { gte: previousStart, lt: windowStart } },
        _count: { id: true },
      }),
    ]);

    const tally = (rows: { eventType: AnalyticsEventType; _count: { id: number } }[]) => {
      const out = { views: 0, productViews: 0, whatsappClicks: 0 };
      for (const row of rows) {
        if (row.eventType === AnalyticsEventType.SHOP_VIEW) out.views = row._count.id;
        else if (row.eventType === AnalyticsEventType.PRODUCT_VIEW) out.productViews = row._count.id;
        else if (row.eventType === AnalyticsEventType.WHATSAPP_CLICK) out.whatsappClicks = row._count.id;
      }
      return out;
    };

    const metrics = tally(currentCounts);
    const previous = tally(previousCounts);

    /**
     * The seven-day chart, in one query rather than fourteen.
     *
     * This was a loop issuing two `count()` calls per day, awaited serially —
     * fourteen round trips, re-run every sixty seconds by `LiveRefresh` for
     * every open tab. The index on (shopId, eventType, createdAt) supported
     * each one individually, so the cost was pure latency.
     *
     * Grouping in the database also puts the day boundary where the seller
     * lives: `date_trunc` at Asia/Kolkata rather than at whatever timezone the
     * Node process happens to run in.
     */
    const days = lastIstDays(CHART_DAYS, now);
    const chartStart = days[0];

    const rows = await db.$queryRaw<{ day: Date; event_type: string; n: bigint }[]>`
      SELECT date_trunc('day', "createdAt" AT TIME ZONE 'Asia/Kolkata') AS day,
             "eventType"::text AS event_type,
             COUNT(*) AS n
      FROM "Analytics"
      WHERE "shopId" = ${shopId}
        AND "createdAt" >= ${chartStart}
        AND "eventType" IN ('SHOP_VIEW', 'WHATSAPP_CLICK')
      GROUP BY 1, 2
    `;

    const byDay = new Map<string, { views: number; clicks: number }>();
    for (const row of rows) {
      // `date_trunc(... AT TIME ZONE ...)` returns a naive local timestamp,
      // which the driver hands back as a Date at UTC — so its ISO date is
      // already the IST calendar day. That is the key we want.
      const key = row.day.toISOString().slice(0, 10);
      const bucket = byDay.get(key) ?? { views: 0, clicks: 0 };
      if (row.event_type === 'SHOP_VIEW') bucket.views = Number(row.n);
      else bucket.clicks = Number(row.n);
      byDay.set(key, bucket);
    }

    // Zero-filled, so a quiet day is a visible gap rather than a missing bar.
    const past7DaysData = days.map((day) => {
      const bucket = byDay.get(istDayKey(day)) ?? { views: 0, clicks: 0 };
      return { date: istDayLabel(day), views: bucket.views, clicks: bucket.clicks };
    });

    return {
      success: true,
      metrics,
      previous,
      windowDays: METRIC_WINDOW_DAYS,
      chartData: past7DaysData,
    };
  } catch (error) {
    logger.error('Error fetching shop analytics', error);
    // Through `toUserMessage` like every other action: returning `error.message`
    // raw is how a database error string reaches a seller's screen.
    return { error: toUserMessage(error, { action: 'getShopAnalytics', shopId }) };
  }
}
