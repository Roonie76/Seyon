/**
 * Overlays, scroll locking, and the sticky sidebar.
 *
 * All three bugs here were measured in a real browser, because none of them is
 * visible to a type check, a build, or a server-side fetch of the HTML:
 *
 * 1. Six overlays rendered a full-screen backdrop without locking the body.
 *    At 390x844 with the development notice open, a wheel event scrolled the
 *    page underneath from 0 to 900 while the modal stayed put.
 * 2. Both nav drawers bound Escape to a backdrop carrying `tabIndex={-1}`.
 *    That makes an element focusable by script and never by the keyboard, so
 *    the handler sat somewhere a key event could not reach it.
 * 3. The blog index root carried `overflow-hidden`, which computes `overflow-y`
 *    to `auto` and makes the element a scroll container. `position: sticky` on
 *    the sidebar inside it therefore never engaged: measured across a scroll
 *    from 0 to 3200, the sidebar's top went 478 -> -2722 instead of pinning at
 *    the 100px its own class asks for.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
/** Comments describe the bug being prevented and would match the guards. */
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Every component that renders a full-screen backdrop of its own. */
const OVERLAYS: Array<[label: string, path: string]> = [
  ['development notice', 'src/frontend/components/shared/dev-notice-modal.tsx'],
  ['shopper nav drawer', 'src/frontend/components/shared/navbar-client.tsx'],
  ['seller nav drawer', 'src/frontend/components/shared/seller-navbar-client.tsx'],
  ['store cart panel', 'src/frontend/components/store/store-cart.tsx'],
  ['product guidelines sheet', 'src/frontend/components/store/product-cta.tsx'],
  ['contact login sheet', 'src/frontend/components/help/ContactClient.tsx'],
];

describe('overlays lock the page behind them', () => {
  it.each(OVERLAYS)('%s locks body scroll while it is open', (_label, path) => {
    const src = strip(read(path));
    expect(src).toContain("from '@/frontend/lib/overlay'");
    expect(src).toMatch(/useBodyScrollLock\(\s*\w+\s*\)/);
  });

  it.each(OVERLAYS.slice(1))('%s closes on Escape from the document', (_label, path) => {
    // The notice is deliberately not dismissible with Escape: acknowledging it
    // writes to localStorage, and a stray keypress should not count as that.
    const src = strip(read(path));
    expect(src).toMatch(/useEscapeKey\(/);
  });

  it('does not bind Escape to an element that cannot receive it', () => {
    for (const [, path] of OVERLAYS) {
      const src = strip(read(path));
      // The exact shape of the bug: a keydown handler on the backdrop, which
      // carried tabIndex={-1} and so never had focus.
      expect(src, path).not.toMatch(/onKeyDown=\{[^}]*Escape/);
    }
  });
});

describe('the scroll lock itself', () => {
  const SRC = strip(read('src/frontend/lib/overlay.ts'));

  it('is reference counted, so one overlay closing does not unlock another', () => {
    expect(SRC).toMatch(/lockCount \+= 1/);
    expect(SRC).toMatch(/lockCount -= 1/);
    expect(SRC).toMatch(/if \(lockCount > 1\) return;/);
    expect(SRC).toMatch(/if \(lockCount > 0\) return;/);
  });

  it('restores what was there rather than blanking the style', () => {
    expect(SRC).toMatch(/previous\?\.overflow \?\? ''/);
  });

  it('compensates for the scrollbar it removes', () => {
    expect(SRC).toMatch(/window\.innerWidth - document\.documentElement\.clientWidth/);
    expect(SRC).toMatch(/paddingRight/);
  });

  it('is the single implementation — the dialog uses it too', () => {
    const dialog = strip(read('src/frontend/components/ui/dialog.tsx'));
    expect(dialog).toContain('lockBodyScroll()');
    expect(dialog).toContain('unlockBodyScroll()');
    expect(dialog).not.toMatch(/document\.body\.style\.overflow\s*=/);
  });
});

describe('blog sidebar sticky', () => {
  const INDEX = read('src/app/(shopper)/blog/page.tsx');
  const SIDEBAR = read('src/frontend/components/blog/Sidebar/Sidebar.tsx');

  it('asks for sticky positioning', () => {
    expect(SIDEBAR).toMatch(/lg:sticky/);
    expect(SIDEBAR).toMatch(/lg:top-\[\d+px\]/);
  });

  it('has no ancestor that turns itself into a scroll container', () => {
    // `overflow-hidden` computes overflow-y to `auto`; `overflow-x-clip` does
    // not, and clips horizontally just the same.
    expect(INDEX).not.toMatch(/className="relative w-full overflow-hidden/);
    expect(INDEX).toMatch(/className="relative w-full overflow-x-clip/);
  });
});

describe('privacy table of contents', () => {
  const SRC = read('src/app/(shopper)/privacy/_components/privacy-sidebar.tsx');

  it('scrolls to the hash on mount only, not every time the hash changes', () => {
    // The loop: an IntersectionObserver wrote the hash while the reader
    // scrolled, a `useSyncExternalStore` re-read it, and an effect keyed on it
    // called scrollIntoView — dragging the reader back up the page. Measured
    // after one scroll and no further input: 1461 1286 652 482 226 226 226.
    expect(SRC).toMatch(/const initialHash = window\.location\.hash/);
    expect(SRC).not.toMatch(/\}, \[hash\]\);/);
  });
});
