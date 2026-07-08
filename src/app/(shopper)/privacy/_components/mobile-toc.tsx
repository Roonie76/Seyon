'use client';

import * as React from 'react';
import { ChevronDown, List } from 'lucide-react';

interface Section {
  id: string;
  label: string;
}

interface MobileTOCProps {
  sections: Section[];
}

export function MobileTOC({ sections }: MobileTOCProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [activeLabel, setActiveLabel] = React.useState<string>('Overview');

  React.useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      const matched = sections.find((s) => s.id === hash);
      if (matched) {
        setActiveLabel(matched.label);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    // Initial run
    handleHashChange();

    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -60% 0px',
      threshold: 0,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const matched = sections.find((s) => s.id === entry.target.id);
          if (matched) {
            setActiveLabel(matched.label);
          }
        }
      });
    }, observerOptions);

    sections.forEach((sec) => {
      const el = document.getElementById(sec.id);
      if (el) observer.observe(el);
    });

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      observer.disconnect();
    };
  }, [sections]);

  const handleLinkClick = (id: string) => {
    setIsOpen(false);
    const targetElement = document.getElementById(id);
    if (targetElement) {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      targetElement.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });
      targetElement.focus({ preventScroll: true });
    }
  };

  return (
    <div className="lg:hidden w-full border border-zinc-200 rounded-xl bg-card shadow-sm mb-6 print:hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-zinc-800 hover:text-zinc-950 transition-colors select-none"
      >
        <span className="flex items-center gap-2">
          <List className="h-4 w-4 text-amber-600" />
          <span>On This Page: <span className="text-[#A77F3A]">{activeLabel}</span></span>
        </span>
        <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <nav aria-label="Mobile Navigation" className="border-t border-zinc-150 p-2 max-h-60 overflow-y-auto bg-zinc-50/50">
          <ul className="space-y-1">
            {sections.map((sec) => (
              <li key={sec.id}>
                <button
                  onClick={() => handleLinkClick(sec.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    activeLabel === sec.label
                      ? 'bg-amber-500/10 text-[#A77F3A] font-bold'
                      : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800'
                  }`}
                >
                  {sec.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}

export default MobileTOC;
