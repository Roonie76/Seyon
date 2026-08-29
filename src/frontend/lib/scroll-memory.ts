'use client';

/**
 * Where the shopper was on a page, so the back control can put them back.
 *
 * "Return to Jewellery" is a `<Link>`, which is a forward navigation, and the
 * App Router scrolls a new entry to the top. Measured: scrolled to 1069px in a
 * listing, opened a product, used the back control — landed at 0. The browser's
 * own back does better but not well, because a dynamic listing is still
 * loading when the restore fires: the same journey through native back landed
 * at 276 of 1069.
 *
 * Neither is "where I was". So the position is recorded as the shopper leaves
 * a page and re-applied when they come back to it through our own control,
 * across a few frames so it survives late layout.
 *
 * Deliberately not `history.back()`: the journey stack records browsing
 * contexts, not history entries — a shopper can walk product to product
 * without touching it — so "one step back in history" and "the page this
 * button names" are not the same place, and the button must go where its
 * label says.
 */

const KEY = 'seyon_scroll_memory';
/** Enough for any plausible session; bounded so sessionStorage cannot grow. */
const MAX_ENTRIES = 30;

type Memory = Record<string, number>;

function read(): Memory {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Memory = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = v;
    }
    return out;
  } catch {
    // Blocked site data, or someone edited the value by hand.
    return {};
  }
}

function write(memory: Memory): void {
  try {
    const entries = Object.entries(memory);
    const trimmed = entries.length > MAX_ENTRIES ? entries.slice(-MAX_ENTRIES) : entries;
    sessionStorage.setItem(KEY, JSON.stringify(Object.fromEntries(trimmed)));
  } catch {
    // Storage blocked or full: the shopper simply lands at the top, as before.
  }
}

/** Records the current scroll position against `path`. */
export function rememberScroll(path: string, y: number): void {
  if (!path || !Number.isFinite(y)) return;
  const memory = read();
  // Re-inserting moves the key to the end, so the trim above drops the oldest.
  delete memory[path];
  memory[path] = Math.max(0, Math.round(y));
  write(memory);
}

/** Reads and clears the position for `path`, so it is used at most once. */
export function consumeScroll(path: string): number | null {
  const memory = read();
  const y = memory[path];
  if (typeof y !== 'number') return null;
  delete memory[path];
  write(memory);
  return y;
}

/**
 * Scrolls to `y` and keeps re-applying it briefly.
 *
 * A dynamic listing grows as images and lazily-rendered rows arrive, and a
 * single `scrollTo` before that finishes lands short — which is exactly how
 * the browser's own restoration reached 276 instead of 1069. Re-applying for
 * a few hundred milliseconds costs nothing and survives the growth, and any
 * real input from the reader cancels it immediately.
 */
export function restoreScroll(y: number, durationMs = 600): void {
  if (typeof window === 'undefined') return;

  const started = performance.now();
  let cancelled = false;

  const cancel = () => {
    cancelled = true;
    window.removeEventListener('wheel', cancel);
    window.removeEventListener('touchstart', cancel);
    window.removeEventListener('keydown', cancel);
  };

  window.addEventListener('wheel', cancel, { once: true, passive: true });
  window.addEventListener('touchstart', cancel, { once: true, passive: true });
  window.addEventListener('keydown', cancel, { once: true });

  const step = () => {
    if (cancelled) return;
    const maxY = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, Math.min(y, Math.max(0, maxY)));
    if (performance.now() - started < durationMs) {
      requestAnimationFrame(step);
    } else {
      cancel();
    }
  };

  requestAnimationFrame(step);
}
