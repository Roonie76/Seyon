'use client';

/**
 * The bottom of the viewport is shared, and nothing was sharing it.
 *
 * Two components fix themselves to `bottom: 0`: the consent banner and the
 * product page's sticky buy bar. They live in different trees and neither knew
 * about the other. Measured at 390x844 on a product page, first visit:
 *
 *   consent banner  top 707  bottom 844  height 138  z-50
 *   sticky buy bar  top 780  bottom 844  height  64  z-40
 *   overlap 64px — the whole bar
 *   elementFromPoint over "Talk to Creator" returned the banner's buttons
 *
 * So a first-time mobile buyer could not tap the order button at all until
 * they had answered the consent banner. And with the banner gone, the bar
 * still covered the last 64px of the page, because `body` had no bottom
 * padding to clear it.
 *
 * Each bar now publishes its own height as a CSS custom property on the root
 * element. The buy bar sits above the banner rather than behind it, and
 * `globals.css` reserves the sum as `body` padding, so nothing is ever hidden
 * underneath either of them. A bar that is not rendered — or is `display:none`
 * at this breakpoint, as the buy bar is on desktop — measures zero and removes
 * its property, so the reservation is exactly what is on screen.
 */
import * as React from 'react';

export function useBottomBarHeight(
  ref: React.RefObject<HTMLElement | null>,
  cssVariable: string
): void {
  React.useEffect(() => {
    const root = document.documentElement;
    const el = ref.current;
    if (!el) {
      root.style.removeProperty(cssVariable);
      return;
    }

    const write = () => {
      // `lg:hidden` makes this `display: none` on desktop, where the height is
      // 0 and the property must come off rather than reserve empty space.
      const height = el.getBoundingClientRect().height;
      if (height > 0) {
        root.style.setProperty(cssVariable, `${Math.ceil(height)}px`);
      } else {
        root.style.removeProperty(cssVariable);
      }
    };

    write();
    const observer = new ResizeObserver(write);
    observer.observe(el);
    // A breakpoint change can hide the bar without resizing it first.
    window.addEventListener('resize', write);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', write);
      root.style.removeProperty(cssVariable);
    };
  }, [ref, cssVariable]);
}

/** The consent banner's measured height, or 0px when it is not shown. */
export const CONSENT_BAR_HEIGHT_VAR = '--consent-bar-h';
/** The product page's sticky buy bar height, or 0px when it is not shown. */
export const BUY_BAR_HEIGHT_VAR = '--buy-bar-h';

/**
 * The sticky header's measured height.
 *
 * The marketplace filter bar was `sticky top-16` — a hard-coded 4rem — while
 * the header is content-sized: measured at 57px on mobile and 65px on desktop,
 * and a whole row taller again when the mobile search field opens. So the
 * filter bar either floated below the header with a gap, or slid underneath
 * it. Reading the real height removes the guess.
 */
export const NAVBAR_HEIGHT_VAR = '--navbar-h';
