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

/**
 * Identifies this tab so it can ignore its own broadcast.
 *
 * `BroadcastChannel` does not deliver a message back to the object that
 * posted it — but `broadcastDataChanged` opens a fresh channel each time, so
 * the listener in the same tab is a different object and did receive it. A
 * seller who changed something therefore got their own refresh on top of the
 * one the mutation already triggered.
 */
const TAB_ID =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

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
    ch.postMessage({ at: Date.now(), from: TAB_ID });
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

  /**
   * Returning to a tab fired three refreshes: `visibilitychange` and `focus`
   * both arrive, and a mutating tab received its own broadcast on top. Each
   * one is a full server round trip for the same page. They are coalesced
   * here rather than at each call site, so any future caller gets the same
   * protection.
   */
  const lastRefreshAtRef = React.useRef(0);
  const COALESCE_MS = 1000;

  const refresh = React.useCallback(
    (immediate = false) => {
      const now = Date.now();
      if (now - lastRefreshAtRef.current < COALESCE_MS) return;
      lastRefreshAtRef.current = now;

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
    ch.onmessage = (event: MessageEvent) => {
      // Ignore the echo of our own mutation.
      if ((event.data as { from?: string } | null)?.from === TAB_ID) return;
      refresh(true);
    };
    return () => ch.close();
  }, [refresh]);

  return { lastUpdated, syncing };
}
