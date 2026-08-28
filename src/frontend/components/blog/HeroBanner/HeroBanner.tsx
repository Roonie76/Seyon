'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export function HeroBanner() {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Get offset percentages relative to the screen center (-1 to 1)
      const x = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
      const y = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
      setOffset({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
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
        {/* The h1 is the strongest on-page signal of what a page is about.
            It read "Luxury Stories" under "Editorial Magazine", which
            described neither what is published here nor what anyone arriving
            from a search wants. */}
        <span className="text-[11px] font-black uppercase tracking-[0.4em] text-[#D4AF37] block">
          The Seyon Blog
        </span>
        {/* Capped, because the old two-word heading did not need a measure and
            this one runs to a thousand pixels on a wide screen. */}
        <h1 className="mx-auto max-w-[16ch] text-balance text-4xl sm:text-5xl md:text-6xl font-light tracking-tight text-white font-serif">
          Things worth knowing before you buy them
        </h1>
        <p className="text-xs uppercase tracking-[0.25em] text-[#9D9D9D]">
          <Link href="/" className="hover:text-white transition-colors">HOME</Link>
          <span className="mx-2 text-zinc-700">/</span>
          <span className="text-[#E4C29D]">BLOG</span>
        </p>
      </div>
    </section>
  );
}
