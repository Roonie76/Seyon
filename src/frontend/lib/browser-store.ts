'use client';

import * as React from 'react';

/**
 * Reading browser-only state (localStorage, location.hash) into React.
 *
 * The pattern these replace — `useState(initial)` plus a `useEffect` that
 * synchronously calls `setState` on mount — triggers a second render pass
 * before paint on every mount. React 19's `react-hooks/set-state-in-effect`
 * rule flags it, and it is exactly what `useSyncExternalStore` exists for:
 * the value lives outside React, so subscribe to it rather than copying it in.
 *
 * The server snapshot is always the neutral value, which keeps the first
 * client render identical to the server's and avoids a hydration mismatch.
 */

/** Events that signal cart state changed, whether from this tab or another. */
export const CART_UPDATED_EVENT = 'seyon-cart-updated';

function subscribeToStorage(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(CART_UPDATED_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CART_UPDATED_EVENT, onChange);
  };
}

/**
 * Subscribe to a value derived from browser storage.
 *
 * `read` must return a primitive (or a cached reference): useSyncExternalStore
 * compares snapshots with Object.is and will loop forever on a fresh object.
 */
export function useStorageValue<T extends string | number | boolean | null>(
  read: () => T,
  serverValue: T
): T {
  return React.useSyncExternalStore(
    subscribeToStorage,
    () => {
      try {
        return read();
      } catch {
        // Private mode, blocked cookies, quota errors — fall back rather than
        // taking the component down.
        return serverValue;
      }
    },
    () => serverValue
  );
}

/**
 * Notify every listener in this tab that browser storage changed.
 * `storage` only fires in *other* tabs, so same-tab subscribers need this.
 */
export function notifyStorageChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CART_UPDATED_EVENT));
}

function subscribeToHash(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

/**
 * The current location hash, without the '#'.
 *
 * As a bonus over the effect it replaces, this now actually responds when the
 * hash changes — the previous version read it once on mount and never again,
 * so in-page navigation left the sidebar highlighting the wrong section.
 */
export function useLocationHash(): string {
  return React.useSyncExternalStore(
    subscribeToHash,
    () => window.location.hash.replace('#', ''),
    () => ''
  );
}
