'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

interface LiveRefreshProps {
  /** Refresh cadence in seconds. Default 60. */
  intervalSeconds?: number;
}

/**
 * Keeps server-rendered dashboard data fresh while the tab is open:
 * - re-fetches via router.refresh() on an interval (only when tab is visible)
 * - refreshes immediately when the seller returns to the tab
 * Renders a small "Live" indicator so sellers know numbers self-update.
 */
export function LiveRefresh({ intervalSeconds = 60 }: LiveRefreshProps) {
  const router = useRouter();
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);

  React.useEffect(() => {
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

  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1 select-none"
      title={lastUpdated ? `Auto-updates every ${intervalSeconds}s · last updated ${lastUpdated.toLocaleTimeString()}` : 'Auto-updating'}
    >
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      Live
    </span>
  );
}
