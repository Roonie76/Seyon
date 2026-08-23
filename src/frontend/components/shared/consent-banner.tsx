'use client';

import * as React from 'react';
import Link from 'next/link';
import { useConsent, setConsent } from '@/frontend/lib/consent';
import { useDevNoticeAcknowledged } from './dev-notice-modal';

/**
 * Notice before tracking, not after.
 *
 * Rendered only while the decision is 'unset', so it appears once and never
 * again. Both buttons are the same size and weight on purpose — a banner where
 * "Accept" is a filled button and "Decline" is grey small print is a dark
 * pattern, and consent obtained that way is not consent.
 */
export function ConsentBanner() {
  const consent = useConsent();
  const devNoticeDismissed = useDevNoticeAcknowledged();

  if (consent !== 'unset') return null;
  // One interruption at a time. The development notice covers the whole
  // viewport, so a banner shown underneath it cannot be clicked at all.
  if (!devNoticeDismissed) return null;

  return (
    <div
      role="region"
      aria-label="Analytics consent"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200 bg-white/95 backdrop-blur px-4 py-4 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-zinc-700">
          We&apos;d like to measure how Seyon is used so we can improve it. This is optional
          and off until you say yes — Seyon works exactly the same either way.{' '}
          <Link href="/privacy" className="font-bold text-[#A77F3A] hover:underline">
            How we handle your data
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setConsent('denied')}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-bold text-zinc-800 hover:bg-zinc-50"
          >
            No thanks
          </button>
          <button
            type="button"
            onClick={() => setConsent('granted')}
            className="rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800"
          >
            That&apos;s fine
          </button>
        </div>
      </div>
    </div>
  );
}
