'use client';

import * as React from 'react';
import { useLocationHash } from '@/frontend/lib/browser-store';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Section {
  id: string;
  label: string;
}

interface PrivacySidebarProps {
  sections: Section[];
}

export function PrivacySidebar({ sections }: PrivacySidebarProps) {
  // The hash is read through a subscription rather than copied into state on
  // mount, so it also tracks in-page navigation — previously the highlight was
  // set once and never updated when the reader jumped to another section.
  const hash = useLocationHash();
  // Scroll position overrides the hash once the reader starts scrolling.
  const [scrolledId, setScrolledId] = React.useState<string>('');
  const activeId = scrolledId || hash || (sections.length > 0 ? sections[0].id : '');

  React.useEffect(() => {
    if (!hash) return;
    const targetElement = document.getElementById(hash);
    if (!targetElement) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(() => {
      targetElement.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    }, 100);
    return () => clearTimeout(timer);
  }, [hash]);

  React.useEffect(() => {
    const observerOptions = {
      root: null, // viewport
      rootMargin: '-10% 0px -75% 0px', // trigger when section is in top portion of screen
      threshold: 0,
    };

    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          setScrolledId(id);
          // Update URL hash without polluting browser history
          window.history.replaceState(null, '', `#${id}`);
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersection, observerOptions);

    sections.forEach((sec) => {
      const el = document.getElementById(sec.id);
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, [sections]);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setScrolledId(id);
    window.history.replaceState(null, '', `#${id}`);

    const targetElement = document.getElementById(id);
    if (targetElement) {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      targetElement.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });
      // Set focus to target for screen readers and keyboard users
      targetElement.focus({ preventScroll: true });
    }
  };

  return (
    <aside className="space-y-8 select-none pr-4 print:hidden">
      {/* Back to Home Link */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-zinc-950 transition-colors uppercase tracking-wider group focus-visible:ring-2 focus-visible:ring-amber-500 rounded-md outline-none py-1"
      >
        <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
        Back to Home
      </Link>

      {/* On This Page List */}
      <div>
        <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4">
          On This Page
        </h2>
        <nav aria-label="Table of Contents" className="border-l border-zinc-200">
          <ul className="space-y-1">
            {sections.map((sec) => {
              const isActive = activeId === sec.id;
              return (
                <li key={sec.id}>
                  <a
                    href={`#${sec.id}`}
                    onClick={(e) => handleLinkClick(e, sec.id)}
                    aria-current={isActive ? 'location' : undefined}
                    className={`block pl-4 py-1.5 -ml-px border-l-2 text-xs font-semibold transition-all outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-inset ${
                      isActive
                        ? 'border-amber-500 text-zinc-950 font-bold'
                        : 'border-transparent text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    {sec.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </aside>
  );
}

export default PrivacySidebar;
