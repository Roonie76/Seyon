'use client';

import * as React from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { useJourney } from './journey-context';

interface BackButtonProps {
  fallbackHref: string;
  label?: string; // Default label if stack is empty (e.g. 'Storefront')
  className?: string;
}

const cleanLabel = (text: string) => {
  return text.replace(/^Back to\s+/i, '');
};

// The actual interactive button that uses client-side hooks and browser history/sessionStorage
function BackButtonInner({ fallbackHref, label = 'Storefront', className = '' }: BackButtonProps) {
  const { stack, truncateJourneyStack } = useJourney();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const isFooterPage = pathname ? (
    pathname.startsWith('/help') ||
    pathname === '/privacy' ||
    pathname === '/terms' ||
    pathname === '/about' ||
    pathname === '/faqs' ||
    pathname === '/contact'
  ) : false;

  const queryString = searchParams ? searchParams.toString() : '';
  const currentPath = pathname + (queryString ? `?${queryString}` : '');
  
  const isCurrentAtTop = stack.length > 0 && stack[stack.length - 1].path === currentPath;
  
  const target = isCurrentAtTop
    ? (stack.length > 1 ? stack[stack.length - 2] : null)
    : (stack.length > 0 ? stack[stack.length - 1] : null);

  const resolvedHref = target ? target.path : fallbackHref;
  const resolvedLabel = cleanLabel(target ? target.label : label);

  /**
   * Records where the shopper is standing on the page they are returning to,
   * so the listing can put them back rather than at the top.
   *
   * Measured before this: 1069px into a listing, open a product, use this
   * control - land at 0. `history.back()` is not the fix, because the journey
   * stack records browsing contexts rather than history entries: a shopper who
   * walked product to product is several history entries away from the listing
   * this button names, and a back control that goes somewhere other than its
   * own label is worse than one that loses the scroll position. See
   * lib/scroll-memory.ts.
   */
  const handleClick = () => {
    if (!target) return;
    try {
      // The value is the destination, not a bare 'true'. With a boolean, an
      // unrelated re-render on the page being left consumed the flag before
      // the destination ever mounted - so the back-navigation was still
      // recorded as a forward one, and there was nothing left to tell the
      // listing to restore its scroll position.
      sessionStorage.setItem('seyon_is_navigating_back', target.path);
    } catch (err) {
      console.error('Failed to set back navigation flag in sessionStorage:', err);
    }
    truncateJourneyStack(target.path);
  };

  if (isFooterPage) {
    return (
      <button
        onClick={() => router.back()}
        aria-label="Go back"
        className={`inline-flex items-center bg-transparent text-zinc-800 dark:text-zinc-250 hover:text-amber-600 dark:hover:text-amber-500 transition-colors duration-200 cursor-pointer select-none group focus:outline-none focus:ring-2 focus:ring-amber-500/50 rounded-sm ${className}`}
        style={{
          fontFamily: 'var(--font-serif-custom), Georgia, serif',
          fontSize: '18px',
          fontWeight: 600,
          letterSpacing: '0.02em',
          textTransform: 'none',
        }}
      >
        ← Go Back
      </button>
    );
  }

  return (
    <Link
      href={resolvedHref}
      onClick={handleClick}
      aria-label={`Go back to ${resolvedLabel}`}
      className={`inline-flex items-center bg-transparent text-zinc-800 dark:text-zinc-250 hover:text-amber-600 dark:hover:text-amber-500 transition-colors duration-200 cursor-pointer select-none group focus:outline-none focus:ring-2 focus:ring-amber-500/50 rounded-sm ${className}`}
      style={{
        fontFamily: 'var(--font-serif-custom), Georgia, serif',
        fontSize: '18px',
        fontWeight: 600,
        letterSpacing: '0.02em',
        textTransform: 'none',
      }}
    >
      <span className="md:hidden">← {resolvedLabel}</span>
      <span className="hidden md:inline">← Return to {resolvedLabel}</span>
    </Link>
  );
}

// Dynamically import the inner component with ssr: false to exclude useSearchParams from the static pre-rendering phase.
// This resolves the Next.js prerender error on static pages like /faqs, /terms, /privacy, /contact, etc.
const BackButtonClient = dynamic(() => Promise.resolve(BackButtonInner), {
  ssr: false,
  loading: () => (
    <span
      className="inline-flex items-center bg-transparent text-zinc-800/65 dark:text-zinc-250/65 select-none"
      style={{
        fontFamily: 'var(--font-serif-custom), Georgia, serif',
        fontSize: '18px',
        fontWeight: 600,
        letterSpacing: '0.02em',
        textTransform: 'none',
      }}
    >
      ← Return
    </span>
  )
});

export function BackButton(props: BackButtonProps) {
  return <BackButtonClient {...props} />;
}

export default BackButton;
