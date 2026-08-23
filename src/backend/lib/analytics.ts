import { db } from '@/lib/db';
import { AnalyticsEventType } from '@prisma/client';
import { z } from 'zod';
import { headers } from 'next/headers';
import { logger } from './logger';
import { rateLimit, RATE_LIMITS } from './rate-limit';

const IdParamSchema = z.string().cuid('Invalid identifier format');
const EventTypeSchema = z.nativeEnum(AnalyticsEventType);

/** Stable shape so callers do not have to narrow a union. */
export interface TrackResult {
  success?: boolean;
  error?: string;
  /** Set when the event was deliberately not written. */
  skipped?: 'bot' | 'duplicate' | 'rate-limited';
  id?: string;
}

/**
 * Crawlers, link unfurlers and uptime checks render pages too. Counting them
 * as store visits made the seller dashboard read several times higher than
 * the real traffic (5 curls produced 5 views; 3 Googlebot hits produced 3).
 */
const BOT_UA =
  /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|preview|monitor|curl|wget|headless|lighthouse|pingdom|uptime|python-requests|axios|go-http-client/i;

/** How long the same viewer's repeat views of the same thing are ignored. */
const VIEW_DEDUPE_WINDOW_MS = 30 * 60 * 1000;

interface RequestSignals {
  ip: string;
  userAgent: string;
  isBot: boolean;
}

async function requestSignals(): Promise<RequestSignals | null> {
  try {
    const h = await headers();
    const ip =
      h.get('x-real-ip') ||
      h.get('x-forwarded-for')?.split(',').pop()?.trim() ||
      'unknown';
    const userAgent = h.get('user-agent') || '';
    return { ip, userAgent, isBot: userAgent === '' || BOT_UA.test(userAgent) };
  } catch {
    // Called outside a request scope (a script, a background job).
    return null;
  }
}

export async function trackEventInternal(
  shopId: string,
  eventType: AnalyticsEventType,
  productId?: string,
  userId?: string | null,
  options: { skipDedupe?: boolean } = {}
): Promise<TrackResult> {
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

    let cleanUserId: string | null = null;
    if (userId) {
      const parsedUserId = IdParamSchema.safeParse(userId);
      if (parsedUserId.success) cleanUserId = parsedUserId.data;
    }

    const signals = await requestSignals();

    // Bots do not count as store traffic.
    if (signals?.isBot) {
      return { success: true, skipped: 'bot' as const };
    }

    // One view per viewer per target per window: a refresh is not a new visit.
    if (!options.skipDedupe && signals) {
      const viewer = cleanUserId ?? signals.ip;
      const target = cleanProductId ?? parsedShopId.data;
      const dedupe = await rateLimit(
        `analyticsview:${parsedEventType.data}:${viewer}:${target}`,
        1,
        VIEW_DEDUPE_WINDOW_MS
      );
      if (!dedupe.success) {
        return { success: true, skipped: 'duplicate' as const };
      }
    }

    const analytics = await db.analytics.create({
      data: {
        shopId: parsedShopId.data,
        productId: cleanProductId,
        userId: cleanUserId,
        eventType: parsedEventType.data,
      },
    });

    return { success: true, id: analytics.id };
  } catch (error) {
    logger.error('Error logging traffic analytics', error);
    return { error: 'Failed to record click metric' };
  }
}

/**
 * Guard for the publicly reachable `trackEvent` server action.
 *
 * The action is exported, unauthenticated and callable directly, so without a
 * limit anyone could write unlimited view/click rows for any shop — inflating
 * a seller's dashboard and manufacturing the WHATSAPP_CLICK rows the review
 * gate looks for.
 */
export async function isTrackingAllowed(): Promise<boolean> {
  const signals = await requestSignals();
  // No request scope means this was not reached over HTTP (a script, a test),
  // so there is no IP to limit and no attacker path to close.
  if (!signals) return true;
  if (signals.isBot) return false;

  const rl = await rateLimit(
    `analytics:${signals.ip}`,
    RATE_LIMITS.ANALYTICS_EVENT.limit,
    RATE_LIMITS.ANALYTICS_EVENT.windowMs
  );
  return rl.success;
}
