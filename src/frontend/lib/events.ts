'use client';

import { posthog } from '@/lib/posthog';

/**
 * The events that describe whether Seyon is working.
 *
 * The funnel matters more than the volume: a seller who signs up, creates a
 * store, but never publishes a product has failed at a specific step, and
 * without these you cannot tell which one. Named and typed here so the same
 * event never gets fired under three different names.
 *
 * Safe to call whether or not PostHog is configured — it no-ops when the
 * client has not loaded, so no call site needs a guard.
 */

export type SeyonEvent =
  // Seller funnel
  | 'seller_signed_up'
  | 'shop_created'
  | 'product_created'
  | 'product_published'
  | 'whatsapp_verified'
  // Buyer funnel
  | 'product_viewed'
  | 'product_wishlisted'
  | 'cart_item_added'
  | 'whatsapp_tapped'
  // Friction: the things that tell you why the funnel leaks
  | 'product_create_failed'
  | 'upload_failed';

type Props = Record<string, string | number | boolean | null | undefined>;

function isLoaded(): boolean {
  return Boolean((posthog as { __loaded?: boolean }).__loaded);
}

export function track(event: SeyonEvent, properties?: Props): void {
  if (typeof window === 'undefined' || !isLoaded()) return;
  try {
    posthog.capture(event, properties);
  } catch {
    // Analytics must never break the interaction it is measuring.
  }
}

/** Associate subsequent events with a signed-in user. */
export function identify(userId: string, properties?: Props): void {
  if (typeof window === 'undefined' || !isLoaded()) return;
  try {
    posthog.identify(userId, properties);
  } catch {
    /* no-op */
  }
}
