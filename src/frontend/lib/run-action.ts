'use client';

/**
 * Call a server action without letting a rejected promise strand the UI.
 *
 * Server actions reject on network failure, a 5xx, or a function timeout —
 * all routine in production. Every call site used to be written as:
 *
 *     setIsLoading(true);
 *     const res = await someAction(...);   // rejects here
 *     setIsLoading(false);                 // never runs
 *
 * which left the form frozen on a disabled spinner with no message and no way
 * to retry. `runAction` converts the rejection into the same `{ error }` shape
 * the actions already return, so the existing error branch handles it.
 *
 * The cast is deliberate: every action in this codebase returns a shape with
 * an optional `error`, and callers always check `res.error` first.
 */

import { broadcastDataChanged } from './live-sync';

export const NETWORK_ERROR =
  "We couldn't reach Seyon. Check your connection and try again — nothing was saved.";

export async function runAction<T extends { error?: string }>(
  fn: () => Promise<T>
): Promise<T> {
  try {
    const res = await fn();
    // A successful mutation tells every other tab in this browser to reload,
    // so a seller with the dashboard open in three tabs sees the change at
    // once rather than waiting out the backstop poll.
    if (!res?.error) broadcastDataChanged();
    return res;
  } catch (err) {
    console.error('Server action failed', err);
    return { error: NETWORK_ERROR } as T;
  }
}
