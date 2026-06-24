'use client';

import * as React from 'react';

export interface JourneyItem {
  path: string;
  label: string;
  type: 'marketplace' | 'category' | 'store' | 'wishlist' | 'blog';
  timestamp: number;
}

export interface JourneyContextValue {
  stack: JourneyItem[];
  isInitialized: boolean;
  pushJourneyItem: (item: JourneyItem) => void;
  truncateJourneyStack: (targetPath: string) => void;
}

const JourneyContext = React.createContext<JourneyContextValue | undefined>(undefined);

export function JourneyProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = React.useState<JourneyItem[]>([]);
  const [isInitialized, setIsInitialized] = React.useState(false);

  // Safely initialize state from sessionStorage on mount (prevents SSR hydration mismatches)
  React.useEffect(() => {
    try {
      const stored = sessionStorage.getItem('seyon_journey_stack');
      if (stored) {
        /* eslint-disable-next-line react-hooks/set-state-in-effect */
        setStack(JSON.parse(stored));
      }
    } catch (err) {
      console.error('Failed to initialize journey stack from sessionStorage:', err);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  const pushJourneyItem = React.useCallback((item: JourneyItem) => {
    setStack((prev) => {
      // Hard guard: avoid consecutive duplicate paths
      if (prev.length > 0 && prev[prev.length - 1].path === item.path) {
        return prev;
      }
      
      // Limit the stack to the last 20 entries
      const next = [...prev, item].slice(-20);
      
      try {
        sessionStorage.setItem('seyon_journey_stack', JSON.stringify(next));
      } catch (err) {
        console.error('Failed to persist journey stack to sessionStorage:', err);
      }
      
      return next;
    });
  }, []);

  const truncateJourneyStack = React.useCallback((targetPath: string) => {
    setStack((prev) => {
      const index = prev.findIndex((item) => item.path === targetPath);
      if (index === -1) return prev;
      
      // Keep everything in the stack up to the target (inclusive)
      const next = prev.slice(0, index + 1);
      
      try {
        sessionStorage.setItem('seyon_journey_stack', JSON.stringify(next));
      } catch (err) {
        console.error('Failed to persist truncated journey stack to sessionStorage:', err);
      }
      
      return next;
    });
  }, []);

  const value = React.useMemo(() => ({
    stack,
    isInitialized,
    pushJourneyItem,
    truncateJourneyStack
  }), [stack, isInitialized, pushJourneyItem, truncateJourneyStack]);

  return (
    <JourneyContext.Provider value={value}>
      {children}
    </JourneyContext.Provider>
  );
}

export function useJourney() {
  const context = React.useContext(JourneyContext);
  if (context === undefined) {
    throw new Error('useJourney must be used within a JourneyProvider');
  }
  return context;
}
