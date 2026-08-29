'use client';

import { useEffect, useRef, useState } from 'react';

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** Stagger delay in milliseconds. */
  delay?: number;
}

/**
 * Fades + slides its children into view the first time they enter the viewport.
 * Pure IntersectionObserver — no animation library. Respects prefers-reduced-motion.
 */
export function Reveal({ children, className = '', delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect reduced-motion + SSR/old-browser fallback: show immediately.
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof IntersectionObserver === 'undefined') {
      const timer = setTimeout(() => setShown(true), 0);
      return () => clearTimeout(timer);
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -10% 0px' }
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      /**
       * `will-change-transform` only while the reveal has not happened yet.
       *
       * It was set unconditionally and never released, so /about held 18
       * permanently promoted compositor layers - one per Reveal - long after
       * every animation had finished. `will-change` is a hint that something
       * is *about* to move; leaving it on is how a page quietly costs memory
       * and texture uploads forever.
       */
      className={`transition-all duration-700 ease-out ${shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 will-change-transform'
        } ${className}`}
    >
      {children}
    </div>
  );
}

export default Reveal;
