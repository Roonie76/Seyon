'use client';

import * as React from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useJourney, JourneyItem } from './journey-context';

export function NavigationTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { stack, isInitialized, pushJourneyItem } = useJourney();

  React.useEffect(() => {
    if (!isInitialized) {
      return;
    }

    // Detect and consume back-navigation flag to prevent tracking backward transitions
    try {
      const isBack = sessionStorage.getItem('seyon_is_navigating_back') === 'true';
      if (isBack) {
        sessionStorage.removeItem('seyon_is_navigating_back');
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

    // 3. Construct the path (preserving search parameters for query/state restoration)
    const queryString = searchParams ? searchParams.toString() : '';
    const fullPath = pathname + (queryString ? `?${queryString}` : '');

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
  }, [pathname, searchParams, pushJourneyItem, stack, isInitialized]);

  return null; // pure behavioral component
}
