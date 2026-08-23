'use client';

import * as React from 'react';
import { useConsent, setConsent } from '@/frontend/lib/consent';

/**
 * Change the analytics decision after the banner is gone.
 *
 * Consent that cannot be withdrawn as easily as it was given is not consent,
 * and a banner that only ever appears once leaves no way back. This lives on
 * the privacy policy — a public page, so it works for signed-out visitors too.
 */
export function ConsentPreference() {
  const consent = useConsent();

  // 'unset' only ever renders on the server snapshot and the first client
  // paint; treating it as "not granted" keeps hydration identical either way.
  const granted = consent === 'granted';

  return (
    <div className="rounded-xl border border-zinc-200 p-4 my-5">
      <p className="text-xs font-bold text-zinc-950">Product analytics</p>
      <p className="mt-1 text-xs text-zinc-600">
        Currently{' '}
        <span className="font-bold">
          {granted ? 'on' : consent === 'denied' ? 'off' : 'off — you have not been asked yet'}
        </span>
        . This choice is stored in this browser, so it applies to this device.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setConsent('denied')}
          disabled={consent === 'denied'}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-bold text-zinc-800 hover:bg-zinc-50 disabled:opacity-40"
        >
          Turn off
        </button>
        <button
          type="button"
          onClick={() => setConsent('granted')}
          disabled={granted}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-bold text-zinc-800 hover:bg-zinc-50 disabled:opacity-40"
        >
          Turn on
        </button>
      </div>
    </div>
  );
}
