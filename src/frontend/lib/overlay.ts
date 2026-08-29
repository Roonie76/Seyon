'use client';

/**
 * Body scroll lock for overlays.
 *
 * Six overlays — the development notice, both nav drawers, the store cart
 * panel, the product enquiry sheet and the contact sheet — rendered a
 * full-screen backdrop without stopping the page underneath from scrolling.
 * Measured at 390x844: with the notice open, `window.scrollTo(0, 900)` moved
 * the page to 900 behind it. On a phone the modal stays put while the content
 * behind it slides away, which reads as a broken page.
 *
 * Two details the naive `document.body.style.overflow = 'hidden'` gets wrong,
 * and this does not:
 *
 * 1. It is reference-counted. The consent banner can open over the notice, and
 *    a dialog can open over a drawer; whichever closes first must not unlock
 *    while another is still open.
 * 2. It replaces the scrollbar with padding of the same width. Otherwise the
 *    page reflows by the gutter width the moment an overlay opens, which shows
 *    up as every fixed and centred element jumping sideways.
 *
 * `overflow: hidden` on `body` is enough to stop the viewport scrolling because
 * `html` has `overflow: visible`, so the body's overflow propagates to the
 * viewport. Position is preserved for free — nothing is moved.
 */
import * as React from 'react';

let lockCount = 0;
let previous: { overflow: string; paddingRight: string } | null = null;

export function lockBodyScroll(): void {
  if (typeof document === 'undefined') return;
  lockCount += 1;
  if (lockCount > 1) return;

  const body = document.body;
  previous = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };

  // The gutter the scrollbar occupied. Zero on overlay scrollbars (macOS,
  // touch), non-zero on Windows and most Linux desktops.
  const gutter = window.innerWidth - document.documentElement.clientWidth;

  body.style.overflow = 'hidden';
  if (gutter > 0) {
    const existing = Number.parseFloat(getComputedStyle(body).paddingRight) || 0;
    body.style.paddingRight = `${existing + gutter}px`;
  }
}

export function unlockBodyScroll(): void {
  if (typeof document === 'undefined') return;
  if (lockCount === 0) return;
  lockCount -= 1;
  if (lockCount > 0) return;

  const body = document.body;
  body.style.overflow = previous?.overflow ?? '';
  body.style.paddingRight = previous?.paddingRight ?? '';
  previous = null;
}

/** Locks the body while `locked` is true and releases it on close or unmount. */
export function useBodyScrollLock(locked: boolean): void {
  React.useEffect(() => {
    if (!locked) return;
    lockBodyScroll();
    return unlockBodyScroll;
  }, [locked]);
}

/** Test-only: the number of overlays currently holding the lock. */
export function __lockCount(): number {
  return lockCount;
}

/**
 * Closes an overlay on Escape.
 *
 * Both nav drawers had `onKeyDown={e => e.key === 'Escape' && close()}` on the
 * backdrop, which also carried `tabIndex={-1}`. A `tabIndex` of -1 makes an
 * element focusable by script but never by the keyboard, so the handler sat on
 * an element that never received a key event and Escape did nothing. The
 * listener belongs on the document, where the key actually lands.
 */
export function useEscapeKey(active: boolean, onEscape: () => void): void {
  // Held in a ref and refreshed after each render, so the listener below is
  // bound once per open rather than re-bound on every parent re-render.
  const handler = React.useRef(onEscape);
  React.useEffect(() => {
    handler.current = onEscape;
  });

  React.useEffect(() => {
    if (!active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handler.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [active]);
}
