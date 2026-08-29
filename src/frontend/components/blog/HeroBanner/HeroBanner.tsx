'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { prefersReducedMotion } from '@/frontend/lib/motion';

interface HeroBannerProps {
  /**
   * The edition month, e.g. "August". Computed on the server and passed in
   * rather than read from `new Date()` here: this is a client component, and a
   * request that straddles midnight on the first of the month would otherwise
   * render one month on the server and another on the client.
   */
  edition: string;
}

export function HeroBanner({ edition }: HeroBannerProps) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  /**
   * Parallax, at the frame rate rather than the pointer rate.
   *
   * This called `setOffset` on every `mousemove` — one React render per pixel
   * of pointer travel, each one re-rendering the hero while the reader is
   * also scrolling. The handler now only records the position; a single
   * `requestAnimationFrame` per frame turns it into at most one state update,
   * which is all the display can show anyway.
   *
   * It also does nothing at all when the reader has asked for reduced motion:
   * a decorative parallax is exactly what that setting is about.
   */
  useEffect(() => {
    if (prefersReducedMotion()) return;

    let frame = 0;
    let pending: { x: number; y: number } | null = null;

    const flush = () => {
      frame = 0;
      if (pending) {
        setOffset(pending);
        pending = null;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      // Offset percentages relative to the screen centre (-1 to 1)
      pending = {
        x: (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2),
        y: (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2),
      };
      if (!frame) frame = requestAnimationFrame(flush);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section className="relative w-full h-[35vh] min-h-[250px] overflow-hidden flex flex-col justify-center items-center text-center px-6 border-b border-zinc-900 bg-[#050505]">
      {/* Parallax Background Layer */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-25 scale-105 transition-transform duration-300 ease-out pointer-events-none"
        style={{
          // Was an Unsplash photograph: a third-party connection on the LCP
          // path of the page meant to bring people in, for a backdrop that is
          // blurred to the point of being texture. Drawn locally instead.
          backgroundImage: 'url("/blog/hero.webp")',
          transform: `translate3d(${offset.x * -15}px, ${offset.y * -15}px, 0) scale(1.05)`,
          filter: 'blur(3px) brightness(0.6)',
        }}
      />

      {/* Dark overlay gradients */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.06),transparent_60%)] pointer-events-none" />

      {/* Content Layer (Parallaxes opposite to bg) */}
      <div
        className="relative z-10 space-y-4 transition-transform duration-300 ease-out"
        style={{
          transform: `translate3d(${offset.x * 10}px, ${offset.y * 10}px, 0)`,
        }}
      >
        <span className="text-[11px] font-black uppercase tracking-[0.4em] text-[#D4AF37] block">
          The Seyon Blog
        </span>
        {/* Capped: the heading is short now, but the measure keeps a longer
            edition name from running the width of a wide screen. */}
        <h1 className="mx-auto max-w-[16ch] text-balance text-4xl sm:text-5xl md:text-6xl font-light tracking-tight text-white font-serif">
          Editorial Magazine
        </h1>
        {/* The month is derived, never typed. A hardcoded "August Edition"
            reads as abandoned from the first of September, and this page is
            rendered per request, so there is no cache to go stale. */}
        <p className="text-sm sm:text-base font-light tracking-[0.2em] uppercase text-[#E4C29D]">
          {edition} Edition
        </p>
        <p className="text-xs uppercase tracking-[0.25em] text-[#9D9D9D]">
          <Link href="/" className="hover:text-white transition-colors">HOME</Link>
          <span className="mx-2 text-zinc-700">/</span>
          <span className="text-[#E4C29D]">BLOG</span>
        </p>
      </div>
    </section>
  );
}
