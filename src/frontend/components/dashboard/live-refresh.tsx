'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

interface LiveRefreshProps {
  /** Refresh cadence in seconds. Default 60. */
  intervalSeconds?: number;
  /** Whether the store is paused (vacation mode). */
  isPaused?: boolean;
}

/**
 * Keeps server-rendered dashboard data fresh while the tab is open:
 * - re-fetches via router.refresh() on an interval (only when tab is visible)
 * - refreshes immediately when the seller returns to the tab
 * Renders a small "Live" / "Offline" indicator so sellers know numbers self-update.
 */
export function LiveRefresh({ intervalSeconds = 60, isPaused = false }: LiveRefreshProps) {
  const router = useRouter();
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLastUpdated(new Date());

    const tick = () => {
      if (document.visibilityState === 'visible') {
        router.refresh();
        setLastUpdated(new Date());
      }
    };

    const id = window.setInterval(tick, intervalSeconds * 1000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        router.refresh();
        setLastUpdated(new Date());
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [router, intervalSeconds]);

  if (isPaused) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 bg-zinc-50 border border-zinc-200/80 rounded-full px-2.5 py-1 select-none tracking-wider uppercase"
        title="Store is paused (vacation mode)"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-300 shrink-0" />
        Offline
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10px] font-bold text-zinc-600 bg-zinc-50 border border-zinc-200/80 rounded-full px-2.5 py-1 select-none tracking-wider uppercase"
      title={lastUpdated ? `Auto-updates every ${intervalSeconds}s · last updated ${lastUpdated.toLocaleTimeString()}` : 'Auto-updating'}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
      Live
    </span>
  );
}
