'use client';

import { useStorageValue, notifyStorageChanged } from './browser-store';

/**
 * Consent for optional analytics.
 *
 * PostHog was initialised unconditionally the moment any page mounted, which
 * set identifying cookies and began capturing pageviews before the visitor had
 * been told anything. Under the DPDP Act 2023 notice comes first and consent is
 * the lawful basis for processing that is not strictly necessary to provide the
 * service — product analytics is squarely in that category.
 *
 * Deliberately narrow. This is not a "manage 47 vendor purposes" dialog: there
 * is exactly one optional processor, so there is exactly one decision. Sign-in
 * sessions, the cart and rate limiting are strictly necessary to run Seyon and
 * are not gated here — they are described in the privacy policy instead.
 *
 * Declining is as easy as accepting, and is remembered, because a banner that
 * makes "no" harder than "yes" is not collecting consent.
 */

export const CONSENT_KEY = 'seyon-analytics-consent';

export type ConsentState = 'granted' | 'denied' | 'unset';

function isConsent(value: string | null): value is 'granted' | 'denied' {
  return value === 'granted' || value === 'denied';
}

/** Synchronous read, for non-React callers such as the PostHog bootstrap. */
export function readConsent(): ConsentState {
  if (typeof window === 'undefined') return 'unset';
  try {
    const stored = window.localStorage.getItem(CONSENT_KEY);
    return isConsent(stored) ? stored : 'unset';
  } catch {
    // Storage blocked entirely. Treat as no consent given: the safe default is
    // to not track, never to assume permission we cannot verify.
    return 'unset';
  }
}

export function setConsent(state: 'granted' | 'denied'): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CONSENT_KEY, state);
  } catch {
    /* Nothing persists in private mode; the in-session decision still applies. */
  }
  notifyStorageChanged();
}

/**
 * Reactive consent, so the banner and the PostHog bootstrap agree without
 * either polling. The server snapshot is 'unset' — matching the first client
 * render, which is what keeps hydration stable.
 */
export function useConsent(): ConsentState {
  return useStorageValue<ConsentState>(readConsent, 'unset');
}
