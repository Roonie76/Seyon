'use client';

import * as React from 'react';
import { useLiveSync } from '@/frontend/lib/live-sync';

interface LiveRefreshProps {
  /** Backstop refresh cadence in seconds. Default 60. */
  intervalSeconds?: number;
  /** Whether the store is paused (vacation mode). */
  isPaused?: boolean;
}

/**
 * Keeps server-rendered dashboard data fresh while the tab is open, and says
 * honestly how fresh it is.
 *
 * This badge used to read "LIVE" with a pulsing green dot over what was a
 * 60-second poll — a seller watching for an order would reasonably read that
 * as seconds. It now states the actual cadence, shows when it last refreshed,
 * and flashes "Updating" when another tab reports a change.
 */
export function LiveRefresh({ intervalSeconds = 60, isPaused = false }: LiveRefreshProps) {
  const { lastUpdated, syncing } = useLiveSync({ intervalSeconds, paused: isPaused });

  const base =
    'inline-flex items-center gap-1.5 text-[10px] font-bold rounded-full px-2.5 py-1 select-none tracking-wider uppercase border';

  if (isPaused) {
    return (
      <span
        className={`${base} text-zinc-500 bg-zinc-50 border-zinc-200/80`}
        title="Store is paused (vacation mode) — automatic refresh is off"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-300 shrink-0" />
        Paused
      </span>
    );
  }

  if (syncing) {
    return (
      <span
        className={`${base} text-amber-700 bg-amber-50 border-amber-200`}
        title="Another tab changed something — reloading"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0 animate-pulse" />
        Updating
      </span>
    );
  }

  return (
    <span
      className={`${base} text-zinc-600 bg-zinc-50 border-zinc-200/80`}
      title={
        lastUpdated
          ? `Refreshes every ${intervalSeconds}s, and immediately when you change something in another tab. Last refreshed ${lastUpdated.toLocaleTimeString()}.`
          : `Refreshes every ${intervalSeconds}s`
      }
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
      {lastUpdated
        ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : 'Auto-updating'}
    </span>
  );
}
