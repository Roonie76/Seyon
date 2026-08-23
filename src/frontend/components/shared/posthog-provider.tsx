'use client';

import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { initPostHog, posthog } from '@/lib/posthog';
import { useConsent } from '@/frontend/lib/consent';
import { ConsentBanner } from './consent-banner';

function PostHogTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname && typeof window !== 'undefined') {
      let url = window.origin + pathname;
      if (searchParams && searchParams.toString()) {
        url = url + `?${searchParams.toString()}`;
      }
      // Only capture if posthog is successfully initialized
      if ((posthog as { __loaded?: boolean }).__loaded) {
        posthog.capture('$pageview', {
          $current_url: url,
        });
      }
    }
  }, [pathname, searchParams]);

  return null;
}

/**
 * Analytics is initialised only after the visitor has agreed to it.
 *
 * Previously `initPostHog()` ran on mount for everyone, so cookies were set and
 * pageviews captured before any notice was shown. Now the effect depends on
 * consent: nothing loads while the decision is 'unset' or 'denied', and the
 * moment someone accepts, the same effect re-runs and brings PostHog up without
 * a page reload.
 *
 * Withdrawal is handled too — `opt_out_capturing` stops collection and clears
 * PostHog's own cookies for anyone who changes their mind after accepting.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const consent = useConsent();

  useEffect(() => {
    if (consent === 'granted') {
      initPostHog();
      return;
    }

    if ((posthog as { __loaded?: boolean }).__loaded) {
      try {
        posthog.opt_out_capturing();
      } catch {
        /* never let analytics teardown break the page */
      }
    }
  }, [consent]);

  return (
    <>
      {consent === 'granted' ? (
        <Suspense fallback={null}>
          <PostHogTracker />
        </Suspense>
      ) : null}
      {children}
      <ConsentBanner />
    </>
  );
}
