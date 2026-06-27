'use client';

import * as React from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname, useSearchParams } from 'next/navigation';
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

  const queryString = searchParams ? searchParams.toString() : '';
  const currentPath = pathname + (queryString ? `?${queryString}` : '');
  
  const isCurrentAtTop = stack.length > 0 && stack[stack.length - 1].path === currentPath;
  
  const target = isCurrentAtTop
    ? (stack.length > 1 ? stack[stack.length - 2] : null)
    : (stack.length > 0 ? stack[stack.length - 1] : null);

  const resolvedHref = target ? target.path : fallbackHref;
  const resolvedLabel = cleanLabel(target ? target.label : label);

  const handleClick = () => {
    if (target) {
      try {
        sessionStorage.setItem('seyon_is_navigating_back', 'true');
      } catch (err) {
        console.error('Failed to set back navigation flag in sessionStorage:', err);
      }
      truncateJourneyStack(target.path);
    }
  };

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
