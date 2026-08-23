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

export const NETWORK_ERROR =
  "We couldn't reach Seyon. Check your connection and try again — nothing was saved.";

export async function runAction<T extends { error?: string }>(
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error('Server action failed', err);
    return { error: NETWORK_ERROR } as T;
  }
}
