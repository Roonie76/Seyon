'use client';

/**
 * The reduced-motion check for JavaScript-driven movement.
 *
 * `globals.css` neutralises CSS animations, transitions and `scroll-behavior`
 * under `prefers-reduced-motion: reduce`, but a media query cannot reach a
 * `behavior: 'smooth'` passed to `scrollBy`, or a parallax effect driven from
 * a `mousemove` handler. Those have to ask.
 */

/** True when the operating system asks for reduced motion. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** `'auto'` when the reader asked for less motion, `'smooth'` otherwise. */
export function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? 'auto' : 'smooth';
}
