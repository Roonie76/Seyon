/**
 * The second pass of the scroll-and-side-effects audit.
 *
 * Everything guarded here was measured in a browser before it was changed.
 * The numbers appear beside each guard so that a future change that undoes
 * one of them fails with the evidence attached, rather than with "expected
 * true, got false".
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { safeParseCart } from '@/frontend/lib/cart-utils';

const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('the bottom of the viewport is shared', () => {
  const BARS = strip(read('src/frontend/lib/bottom-bars.ts'));
  const BANNER = strip(read('src/frontend/components/shared/consent-banner.tsx'));
  const BUYBAR = strip(read('src/frontend/components/store/sticky-buy-bar.tsx'));
  const CSS = read('src/app/globals.css');

  it('both bottom bars publish their height', () => {
    expect(BANNER).toMatch(/useBottomBarHeight\(ref, CONSENT_BAR_HEIGHT_VAR\)/);
    expect(BUYBAR).toMatch(/useBottomBarHeight\(ref, BUY_BAR_HEIGHT_VAR\)/);
  });

  it('the buy bar sits above the consent banner, not behind it', () => {
    // Measured at 390x844: banner 707-844, bar 780-844, overlap 64px — the
    // whole bar — and elementFromPoint over "Talk to Creator" returned the
    // banner. After: overlap 0, the button is the topmost element.
    expect(BUYBAR).toMatch(/bottom-\[var\(--consent-bar-h,0px\)\]/);
    expect(BUYBAR).not.toMatch(/className="fixed bottom-0 inset-x-0 z-40/);
  });

  it('the page reserves room for whatever is fixed to the bottom', () => {
    // Measured: body padding-bottom 0, so the bar covered the last 64px of
    // every product page. After: 202px, which is 138 + 64.
    expect(CSS).toMatch(
      /padding-bottom: calc\(var\(--consent-bar-h, 0px\) \+ var\(--buy-bar-h, 0px\)\);/
    );
  });

  it('removes its property when the bar is not on screen', () => {
    // `lg:hidden` on desktop measures 0; reserving space for it would be a
    // permanent unexplained gap.
    expect(BARS).toMatch(/root\.style\.removeProperty\(cssVariable\)/);
  });
});

describe('sticky offsets read the real header height', () => {
  const NAV = strip(read('src/frontend/components/shared/navbar-client.tsx'));
  const FILTERS = strip(read('src/app/(shopper)/marketplace/filters.tsx'));

  it('the header publishes its height', () => {
    expect(NAV).toMatch(/useBottomBarHeight\(headerRef, NAVBAR_HEIGHT_VAR\)/);
  });

  it('the filter bar no longer assumes 4rem', () => {
    // Measured: header 57px on mobile, 67px on desktop, and 99px with the
    // mobile search open — where `top-16` put the filter bar 35px *underneath*
    // the header. After: filter top == header bottom at all three.
    expect(FILTERS).not.toMatch(/sticky top-16/);
    expect(FILTERS).toMatch(/sticky top-\[var\(--navbar-h,4rem\)\]/);
  });
});

describe('browser storage can be blocked', () => {
  const UTILS = strip(read('src/frontend/lib/cart-utils.ts'));
  const NAV = strip(read('src/frontend/components/shared/navbar-client.tsx'));

  it('scanning the cart keys cannot throw out of the function', () => {
    // Reproduced with storage denied: every page rendered "Something went
    // wrong" with a SecurityError inside <NavbarClient>. Accessing
    // `localStorage` throws, it does not merely return empty.
    expect(UTILS).toMatch(/export function getAllCartShopIds[\s\S]{0,900}?try \{/);
    expect(UTILS).toMatch(/export function getAllCartItems[\s\S]{0,600}?try \{/);
  });

  it('the navbar subscribes to the cart rather than reading it during render', () => {
    // Also the hydration mismatch: the server rendered 0 and the client's
    // first render rendered the real count.
    expect(NAV).toMatch(/const cartCount = useStorageValue\(getTotalCartCount, 0\)/);
    expect(NAV).not.toMatch(/useState\(\(\) => \{[\s\S]{0,200}getTotalCartCount\(\)/);
  });

  it('the cart panels start from the same empty state the server rendered', () => {
    for (const path of [
      'src/frontend/components/store/store-cart.tsx',
      'src/frontend/components/store/product-cta.tsx',
    ]) {
      const src = strip(read(path));
      expect(src, path).not.toMatch(/React\.useState<CartItem\[\]>\(\(\) => getLocalCart/);
      expect(src, path).toMatch(/React\.useState<CartItem\[\]>\(\[\]\)/);
    }
  });

  it('still parses a real cart correctly', () => {
    const items = safeParseCart(
      JSON.stringify([
        { productId: 'p', title: 'T', price: 10, quantity: 2, selectionsKey: '_', selections: {} },
      ])
    );
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
  });
});

describe('public queries are bounded', () => {
  const STOREFRONT = read('src/backend/lib/storefront.ts');
  const HUB = read('src/app/(shopper)/blog/topic/[topic]/page.tsx');
  const CREATORS = read('src/app/(shopper)/creators/page.tsx');
  const SITEMAP = read('src/app/sitemap.ts');

  it('the storefront caps products, images and reviews', () => {
    expect(STOREFRONT).toMatch(/take: STOREFRONT_PRODUCT_LIMIT \+ 1/);
    expect(STOREFRONT).toMatch(/take: STOREFRONT_REVIEW_LIMIT/);
    // The grid renders images[0] and nothing else.
    expect(STOREFRONT).toMatch(/orderBy: \{ displayOrder: 'asc' \},[\s\S]{0,200}take: 1,/);
  });

  it('the storefront query is memoised per request', () => {
    expect(STOREFRONT).toMatch(/export const getShopBySlug = cache\(/);
  });

  it('the storefront says when it is showing a subset', () => {
    // The cap must never hide a seller's stock silently.
    const PAGE = read('src/app/(shopper)/store/[shopSlug]/page.tsx');
    expect(PAGE).toMatch(/hasMoreProducts/);
    expect(PAGE).toMatch(/showing \$\{activeProducts\.length\} of \$\{shop\._count\.products\}/);
  });

  it('the other three public findMany calls have a take', () => {
    expect(HUB).toMatch(/take: TOPIC_HUB_LIMIT/);
    expect(CREATORS).toMatch(/take: CREATOR_DIRECTORY_LIMIT/);
    expect(SITEMAP).toMatch(/take: SITEMAP_POST_LIMIT/);
  });

  it('the blog hub does not load article bodies to render cards', () => {
    expect(HUB).toMatch(/omit: \{ content: true \}/);
  });
});

describe('motion is optional', () => {
  const CSS = read('src/app/globals.css');

  it('reduced motion is honoured once, globally', () => {
    expect(CSS).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(CSS).toMatch(/scroll-behavior: auto !important;/);
  });

  it('does not zero the durations, so transitionend still fires', () => {
    // The marketplace filter panel releases its clip on `transitionend`. A
    // duration of exactly 0 would never fire it and the panel would stay
    // clipped forever for anyone using reduced motion.
    expect(CSS).toMatch(/transition-duration: 0\.01ms !important;/);
    expect(CSS).not.toMatch(/transition-duration: 0s !important;/);
  });

  it('the scroll option a media query cannot reach is guarded in code', () => {
    const CAROUSEL = strip(read('src/frontend/components/shared/product-carousel.tsx'));
    expect(CAROUSEL).toMatch(/behavior: scrollBehavior\(\)/);
    expect(CAROUSEL).not.toMatch(/behavior: 'smooth'/);
  });

  it('the blog hero updates once a frame, not once a pixel', () => {
    const HERO = strip(read('src/frontend/components/blog/HeroBanner/HeroBanner.tsx'));
    expect(HERO).toMatch(/requestAnimationFrame\(flush\)/);
    expect(HERO).toMatch(/if \(prefersReducedMotion\(\)\) return;/);
    // The whole bug: setState directly in the handler.
    expect(HERO).not.toMatch(/setOffset\(\{ x, y \}\)/);
  });

  it('the about page releases its compositor layers', () => {
    // 18 permanently promoted layers, one per Reveal, long after the
    // animations finished.
    const REVEAL = strip(read('src/app/(shopper)/about/_components/reveal.tsx'));
    expect(REVEAL).not.toMatch(/ease-out will-change-transform/);
    expect(REVEAL).toMatch(/translate-y-8 will-change-transform/);
  });
});

describe('scroll containers behave', () => {
  it('every capped scroll region contains its overscroll', () => {
    const files = [
      'src/app/(shopper)/marketplace/filters.tsx',
      'src/app/(shopper)/marketplace/search-input.tsx',
      'src/app/(shopper)/privacy/_components/mobile-toc.tsx',
      'src/frontend/components/shared/navbar-client.tsx',
      'src/frontend/components/shared/seller-navbar-client.tsx',
    ];
    for (const f of files) {
      const src = read(f);
      const lines = src.split('\n').filter((l) => l.includes('overflow-y-auto') && l.includes('max-h'));
      expect(lines.length, `${f} has no capped scroll region`).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line, `${f}: ${line.trim().slice(0, 80)}`).toContain('overscroll-contain');
      }
    }
  });

  it('.no-scrollbar exists, having been used in four places and defined in none', () => {
    const CSS = read('src/app/globals.css');
    expect(CSS).toMatch(/\.no-scrollbar \{/);
    expect(CSS).toMatch(/\.no-scrollbar::-webkit-scrollbar \{/);
  });

  it('the filter panel only clips while it is animating', () => {
    // Measured on /?q=a: the category menu is 215px tall and 14px of it was
    // visible, with the second option unclickable. After: 215px, clickable.
    const FILTERS = strip(read('src/app/(shopper)/marketplace/filters.tsx'));
    expect(FILTERS).toMatch(/isDesktopOpen && panelSettled \? 'overflow-visible' : 'overflow-hidden'/);
    expect(FILTERS).toMatch(/onTransitionEnd/);
  });

  it('the help page clips its own decoration', () => {
    // 495px of content in a 390px viewport, held back only by the global
    // body clip. /faqs redirects here, so this covers both.
    const HELP = read('src/app/(shopper)/help/page.tsx');
    expect(HELP).toMatch(/py-16 md:py-24 relative overflow-x-clip/);
  });

  it('closing a dialog does not move the page', () => {
    const DIALOG = strip(read('src/frontend/components/ui/dialog.tsx'));
    expect(DIALOG).toMatch(/previousFocusRef\.current\?\.focus\?\.\(\{ preventScroll: true \}\)/);
  });
});

describe('the back control returns you to your place', () => {
  const BACK = strip(read('src/frontend/components/shared/back-button.tsx'));
  const TRACKER = strip(read('src/frontend/components/shared/navigation-tracker.tsx'));

  it('records the scroll position as it happens, not only on the way out', () => {
    // Recording it in a closure and writing once in the effect cleanup failed
    // one run in three: the cleanup only sees what its own effect instance
    // accumulated, and the App Router's scroll-to-top on hydration can land
    // between the scroll and the navigation. Writing through on a throttle
    // has no lifetime to get wrong. Four standalone runs, four restorations.
    expect(TRACKER).toMatch(/rememberScroll\(currentPath, y\)/);
    expect(TRACKER).toMatch(/window\.setTimeout\([\s\S]{0,120}?250\)/);
    expect(TRACKER).toMatch(/window\.addEventListener\('pagehide', commit\)/);
    // The racy shape, so it cannot come back.
    expect(TRACKER).not.toMatch(/let latest = window\.scrollY/);
  });

  it('restores it only on the page the control actually aimed at', () => {
    // The flag used to be a bare 'true', and a re-render of the page being
    // left consumed it before the destination mounted — so the restore never
    // ran, and the back-navigation was still recorded as a forward one.
    expect(BACK).toMatch(/sessionStorage\.setItem\('seyon_is_navigating_back', target\.path\)/);
    expect(BACK).not.toMatch(/'seyon_is_navigating_back', 'true'/);
    expect(TRACKER).toMatch(/backTarget === currentPath/);
  });

  it('does not guess at history depth', () => {
    // The journey stack records browsing contexts, not history entries, so
    // "one step back" and "the page this button names" are different places.
    expect(BACK).not.toMatch(/canUseHistoryBack/);
  });
});

describe('destructive and repeatable actions are guarded', () => {
  const CART = strip(read('src/app/(shopper)/cart/cart-client.tsx'));
  const STORECART = strip(read('src/frontend/components/store/store-cart.tsx'));

  it('clearing a shop cart asks first', () => {
    expect(CART).toMatch(/clearArmedShopId/);
    expect(CART).toMatch(/setClearArmedShopId\(shopId\)/);
    expect(CART).not.toMatch(/onClick=\{\(\) => clearStore\(shopId\)\}[\s\S]{0,200}Clear Cart/);
  });

  it('checkout cannot be fired twice', () => {
    // Both entry points await a round of analytics calls before opening
    // WhatsApp, so a double-tap opened two tabs with the same order.
    expect(CART).toMatch(/if \(checkingOutShopId\) return;/);
    expect(CART).toMatch(/setCheckingOutShopId\(null\)/);
    expect(STORECART).toMatch(/items\.length === 0 \|\| isCheckingOut/);
    expect(STORECART).toMatch(/disabled=\{isCheckingOut\}/);
  });
});

describe('requests do not race or pile up', () => {
  const SEARCH = strip(read('src/app/(shopper)/marketplace/search-input.tsx'));
  const SYNC = strip(read('src/frontend/lib/live-sync.ts'));

  it('a superseded suggestion request is aborted', () => {
    expect(SEARCH).toMatch(/new AbortController\(\)/);
    expect(SEARCH).toMatch(/signal: controller\.signal/);
    expect(SEARCH).toMatch(/return \(\) => controller\.abort\(\)/);
  });

  it('suggestions are not fetched for a dropdown nobody opened', () => {
    expect(SEARCH).toMatch(/if \(!showDropdown\) return;/);
  });

  it('returning to a tab refreshes once, not three times', () => {
    // visibilitychange + focus both fire, and a mutating tab received the
    // echo of its own broadcast.
    expect(SYNC).toMatch(/lastRefreshAtRef/);
    expect(SYNC).toMatch(/if \(now - lastRefreshAtRef\.current < COALESCE_MS\) return;/);
    expect(SYNC).toMatch(/\?\.from === TAB_ID\) return;/);
    expect(SYNC).toMatch(/from: TAB_ID/);
  });
});

describe('dead code is gone', () => {
  it('there is only one ReadingProgress', () => {
    // Two divergent copies existed; the unimported one still used the
    // pre-rebrand amber gradient, so a fix applied there would have been
    // invisible.
    expect(existsSync(join(ROOT, 'src/app/(shopper)/blog/[slug]/reading-progress.tsx'))).toBe(false);
    expect(existsSync(join(ROOT, 'src/frontend/components/blog/ReadingProgress/ReadingProgress.tsx'))).toBe(true);
  });

  it('admin pages no longer subtract a navbar that does not exist', () => {
    // All ten subtracted 4rem for a navbar; there is no admin/layout.tsx and
    // nothing renders one.
    expect(existsSync(join(ROOT, 'src/app/admin/layout.tsx'))).toBe(false);
    for (const page of [
      'src/app/admin/kyc/page.tsx',
      'src/app/admin/reports/page.tsx',
      'src/app/admin/stores/page.tsx',
    ]) {
      expect(read(page), page).not.toContain('calc(100vh-4rem)');
    }
  });
});
