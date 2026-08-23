'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

/**
 * Cross-tab propagation for seller data.
 *
 * There is no realtime transport here and the UI no longer claims otherwise.
 * What there is:
 *
 *   - an immediate broadcast to every other tab in this browser the moment a
 *     mutation succeeds, so the common case (one seller, dashboard open in
 *     three tabs) converges in milliseconds rather than up to a minute
 *   - a background poll as the backstop for the uncommon case (a second
 *     device, or a change made outside this browser)
 *   - a refresh whenever the tab regains focus, which covers "came back to
 *     the laptop after doing something on the phone"
 *
 * BroadcastChannel is same-origin and same-browser only; that is exactly the
 * scope of the problem it solves, and it needs no server, no connection and
 * no new failure mode.
 */

const CHANNEL = 'seyon-seller-data';

type Channel = { postMessage: (msg: unknown) => void; close: () => void } | null;

function openChannel(): Channel {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  try {
    return new BroadcastChannel(CHANNEL);
  } catch {
    return null;
  }
}

/**
 * Announce that seller-owned data changed. Safe to call from anywhere; a
 * browser without BroadcastChannel simply falls back to the poll.
 */
export function broadcastDataChanged(): void {
  const ch = openChannel();
  if (!ch) return;
  try {
    ch.postMessage({ at: Date.now() });
  } finally {
    ch.close();
  }
}

export interface LiveSyncOptions {
  /** Backstop poll interval in seconds. */
  intervalSeconds?: number;
  /** Skip polling entirely (e.g. a paused store nobody is watching). */
  paused?: boolean;
}

export interface LiveSyncState {
  lastUpdated: Date | null;
  /** True while a refresh triggered by another tab is in flight. */
  syncing: boolean;
}

export function useLiveSync({
  intervalSeconds = 60,
  paused = false,
}: LiveSyncOptions = {}): LiveSyncState {
  const router = useRouter();
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [syncing, setSyncing] = React.useState(false);

  const refresh = React.useCallback(
    (immediate = false) => {
      if (immediate) setSyncing(true);
      router.refresh();
      setLastUpdated(new Date());
      if (immediate) {
        // The refresh is a server round trip with no completion callback;
        // this is purely the visual acknowledgement.
        window.setTimeout(() => setSyncing(false), 600);
      }
    },
    [router]
  );

  React.useEffect(() => {
    // Stamped after mount so the server and client render the same markup.
    queueMicrotask(() => setLastUpdated(new Date()));
  }, []);

  React.useEffect(() => {
    if (paused) return;

    const tick = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const id = window.setInterval(tick, intervalSeconds * 1000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [refresh, intervalSeconds, paused]);

  React.useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    let ch: BroadcastChannel;
    try {
      ch = new BroadcastChannel(CHANNEL);
    } catch {
      return;
    }
    ch.onmessage = () => refresh(true);
    return () => ch.close();
  }, [refresh]);

  return { lastUpdated, syncing };
}
