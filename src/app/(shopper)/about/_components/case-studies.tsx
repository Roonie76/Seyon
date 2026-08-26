'use client';

import { useState } from 'react';
import { Quote, Star, ArrowUpRight } from 'lucide-react';

const STORIES = [
  {
    tab: 'Handmade Jewellery',
    name: 'Aarti R.',
    craft: 'Handmade Jewellery · Jaipur',
    challenge:
      'Selling through Instagram DMs was chaotic—lost orders, manual pricing screenshots, and zero brand ownership.',
    solution:
      'Aarti launched her Seyon storefront in one afternoon. Now, buyers browse her curated catalog and tap to purchase direct—retaining 100% of her margin with zero middleman friction.',
    stats: [
      { value: '1 Afternoon', label: 'Setup Time' },
      { value: '0%', label: 'Commission' },
      { value: '3x', label: 'Catalog Views' },
    ],
    quote:
      'I used to lose half my orders in the chaos of social threads. Now, my Seyon link does the selling and handles the details.',
  },
  {
    tab: 'Home Bakery',
    name: 'Meera & Sons',
    craft: 'Artisanal Bakery · Bengaluru',
    challenge:
      'Meera relied on spreadsheets and individual phone calls to coordinate weekend bake sales. Repeating customers lacked a direct ordering route.',
    solution:
      'She set up a digital menu on Seyon, connected WhatsApp checkout, and let her trust score build with every successful delivery.',
    stats: [
      { value: 'Daily', label: 'Baking Flow' },
      { value: '4.9★', label: 'Trust Rating' },
      { value: 'WhatsApp', label: 'Direct Checkout' },
    ],
    quote:
      'Our regulars simply order from the link. The trust badge instantly validated our brand for new buyers.',
  },
  {
    tab: 'Clay Crafts',
    name: 'Kiran P.',
    craft: 'Ceramics & Pottery · Kochi',
    challenge:
      'Massive marketplace listings buried Kiran\'s handcrafted ceramics under factory-made mugs, while taking heavy platform cuts.',
    solution:
      'Kiran created a beautiful, high-end gallery on Seyon. Collectors find his creations through organic categories and connect directly to buy.',
    stats: [
      { value: 'Rank #1', label: 'In Clay Niche' },
      { value: 'Direct', label: 'Client Contact' },
      { value: '₹0', label: 'Middleman Fees' },
    ],
    quote:
      'For the first time, my work is displayed like a gallery. Buyers value the craft, not just the price.',
  },
];

export function CaseStudies() {
  const [active, setActive] = useState(0);
  const s = STORIES[active];

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Premium Editorial Tab Selectors */}
      <div
        role="tablist"
        aria-label="Seller stories"
        className="flex flex-col sm:flex-row justify-center items-center gap-6 sm:gap-12 border-b border-zinc-900 pb-6 mb-12"
      >
        {STORIES.map((story, i) => {
          const selected = i === active;
          return (
            <button
              key={story.tab}
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(i)}
              className="relative py-2 text-sm font-bold uppercase tracking-[0.2em] transition-all duration-300 active:scale-95 group"
            >
              <span
                className={`transition-colors duration-300 ${selected ? 'text-[#E5C07B]' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
              >
                {story.tab}
              </span>
              {/* Premium under-line indicator */}
              <span
                className={`absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-[#E5C07B] to-[#9C752B] transition-all duration-500 ${selected ? 'w-full' : 'w-0 group-hover:w-1/2'
                  }`}
              />
            </button>
          );
        })}
      </div>

      {/* Narrative Panel */}
      <div
        role="tabpanel"
        className="relative overflow-hidden rounded-3xl border border-zinc-900 bg-gradient-to-b from-[#0a0a0b] to-[#040405] p-8 sm:p-14 shadow-[0_25px_60px_rgba(0,0,0,0.8)] transition-all duration-500 hover:border-yellow-500/10"
      >
        {/* Subtle grid pattern background to feel high-end */}
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />

        <div className="relative z-10 grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          {/* Left Column: Narrative Details */}
          <div className="lg:col-span-7 space-y-8">
            <div className="flex items-center gap-1 text-[#E5C07B]/80">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-current stroke-none" />
              ))}
            </div>

            <div className="space-y-6">
              <div>
                <h4 className="text-[11px] font-black uppercase tracking-[0.25em] text-[#E5C07B]/60 mb-2">
                  The Hurdle
                </h4>
                <p className="text-zinc-400 text-base leading-relaxed font-light">
                  {s.challenge}
                </p>
              </div>
              <div>
                <h4 className="text-[11px] font-black uppercase tracking-[0.25em] text-[#E5C07B]/60 mb-2">
                  The Transformation
                </h4>
                <p className="text-zinc-200 text-base leading-relaxed font-normal">
                  {s.solution}
                </p>
              </div>
            </div>

            {/* High-End Editorial Serif Quote block */}
            <figure className="relative pt-6 border-t border-zinc-900">
              <Quote className="absolute -top-3 right-0 h-20 w-20 text-[#E5C07B]/3 rotate-180 pointer-events-none" />
              <blockquote className="font-serif text-xl sm:text-2xl text-white font-light italic leading-relaxed">
                “{s.quote}”
              </blockquote>
              <figcaption className="mt-4 text-xs font-mono uppercase tracking-wider text-zinc-500">
                — <span className="font-bold text-[#E5C07B]">{s.name}</span>, {s.craft}
              </figcaption>
            </figure>
          </div>

          {/* Right Column: Premium Metric Cards */}
          <div className="lg:col-span-5 grid gap-4">
            {s.stats.map((stat) => (
              <div
                key={stat.label}
                className="group/metric relative overflow-hidden rounded-2xl border border-zinc-900/80 bg-black/40 p-6 transition-all duration-300 hover:border-yellow-500/10 hover:bg-black/60"
              >
                {/* Micro corner highlight */}
                <div className="absolute top-0 right-0 p-3 opacity-0 group-hover/metric:opacity-100 transition-opacity duration-300">
                  <ArrowUpRight className="h-4 w-4 text-[#E5C07B]/50" />
                </div>

                <p className="text-3xl sm:text-4xl font-extralight tracking-tight text-[#E5C07B] font-sans">
                  {stat.value}
                </p>
                <p className="mt-1 text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] transition-colors group-hover/metric:text-zinc-400">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CaseStudies;
