'use client';

import * as React from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useJourney, JourneyItem } from './journey-context';
import { rememberScroll, consumeScroll, restoreScroll } from '@/frontend/lib/scroll-memory';

export function NavigationTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { stack, isInitialized, pushJourneyItem } = useJourney();

  const queryString = searchParams ? searchParams.toString() : '';
  const currentPath = pathname + (queryString ? `?${queryString}` : '');

  /**
   * Records the scroll position of the page currently on screen, as it moves.
   *
   * The obvious implementation - track the position in a closure and write it
   * once in the effect cleanup - is racy, and measurably so: it failed one run
   * in three. The cleanup only sees the value its own effect instance
   * accumulated, and in dev the App Router's scroll-to-top on hydration can
   * land between a scroll and the navigation, leaving the live instance with
   * nothing recorded while `window.scrollY` says otherwise.
   *
   * Writing straight through on a throttle removes the lifetime question
   * entirely: whatever instance is alive, the last position is already in
   * storage. A write every 250ms during active scrolling is far cheaper than
   * the render it replaces, and `consumeScroll` clears the entry when it is
   * used, so nothing accumulates.
   */
  React.useEffect(() => {
    let timer = 0;

    const commit = () => {
      const y = window.scrollY;
      if (y > 0) rememberScroll(currentPath, y);
    };

    const onScroll = () => {
      if (timer) return;
      timer = window.setTimeout(() => {
        timer = 0;
        commit();
      }, 250);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    // A hard navigation unloads the document without running React cleanup.
    window.addEventListener('pagehide', commit);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', commit);
      if (timer) window.clearTimeout(timer);
      commit();
    };
  }, [currentPath]);

  React.useEffect(() => {
    if (!isInitialized) {
      return;
    }

    // Detect and consume back-navigation flag to prevent tracking backward transitions
    try {
      // The flag holds the destination the back control aimed at, and is only
      // honoured once that destination is actually on screen. Keyed on a bare
      // boolean it was consumed by a re-render of the page being left - the
      // effect re-runs when the journey stack is truncated - so the flag was
      // gone by the time the destination mounted.
      const backTarget = sessionStorage.getItem('seyon_is_navigating_back');
      if (backTarget === currentPath) {
        sessionStorage.removeItem('seyon_is_navigating_back');
        // The shopper came back here deliberately, so put them where they
        // were rather than at the top of the page.
        const y = consumeScroll(currentPath);
        if (y !== null && y > 0) restoreScroll(y);
        return;
      }
    } catch (err) {
      console.error('Failed to read/write back navigation flag:', err);
    }

    // 1. Determine if this route is a distinct, valid browsing context
    const segments = pathname.split('/').filter(Boolean);
    
    // Exclude product details: /store/[shopSlug]/[productSlug]
    const isProductDetail = segments[0] === 'store' && segments.length === 3;
    
    // Exclude blog articles: /blog/[articleSlug]
    const isBlogDetail = segments[0] === 'blog' && segments.length === 2;
    
    // Exclude system paths, API endpoints, static assets
    const isSystemPath = pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname.includes('.');
    
    if (isProductDetail || isBlogDetail || isSystemPath) {
      return;
    }

    // 2. Resolve label & type based on pathname only (ignoring query parameters for naming)
    let label = 'Marketplace';
    let type: JourneyItem['type'] = 'marketplace';

    if (pathname === '/' || pathname.startsWith('/marketplace')) {
      label = 'Marketplace';
      type = 'marketplace';
    } else if (pathname.startsWith('/store/')) {
      const shopSlug = segments[1];
      if (shopSlug && segments.length === 2) {
        label = shopSlug
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        type = 'store';
      } else {
        return; // Ignore sub-routes or admin storefront configuration routes
      }
    } else if (pathname.startsWith('/category/')) {
      const categorySlug = segments[1];
      if (categorySlug && segments.length === 2) {
        label = decodeURIComponent(categorySlug)
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        type = 'category';
      } else {
        return;
      }
    } else if (pathname.startsWith('/wishlist')) {
      label = 'Wishlist';
      type = 'wishlist';
    } else if (pathname.startsWith('/blog')) {
      label = 'Blog';
      type = 'blog';
    } else {
      return; // Ignore other untracked layouts (e.g. login, terms, contact, admin, seller dashboards)
    }

    // 3. The path, with its search parameters, as the journey entry key.
    const fullPath = currentPath;

    // 4. Duplicate context check: if the most recent journey entry represents the same path, do not push
    if (stack.length > 0 && stack[stack.length - 1].path === fullPath) {
      return;
    }

    // 5. Record the browsing context
    pushJourneyItem({
      path: fullPath,
      label,
      type,
      timestamp: Date.now(),
    });
  }, [pathname, currentPath, pushJourneyItem, stack, isInitialized]);

  return null; // pure behavioral component
}
