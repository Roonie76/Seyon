import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronDown } from 'lucide-react';
import { Reveal } from './_components/reveal';
import { CaseStudies } from './_components/case-studies';

/*
 * This page used to load Plus Jakarta Sans and Cormorant Garamond of its own
 * accord and override --font-sans-custom / --font-serif-custom locally, so it
 * was the one page that would have ignored a site-wide font change. Both are
 * gone; it inherits the root face like everything else.
 */

export const metadata: Metadata = {
  title: 'About Seyon — Social-Commerce Storefronts for Independent Sellers',
  description:
    'Seyon gives independent sellers across India a premium storefront in minutes and lets buyers order direct over WhatsApp, Instagram, and Telegram — no checkout, no commissions, no middlemen.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About Seyon',
    description:
      'Premium, instant storefronts for independent sellers. Discover and buy direct — no checkout, no commissions.',
    type: 'website',
  },
};

const CATEGORIES = [
  'Fashion & Apparel',
  'Art & Collectibles',
  'Beauty & Wellness',
  'Home & Living',
  'Clay Crafts',
  'DIY & Handmade',
  'Food & Beverages',
];

const FEATURES = [
  {
    num: '01',
    title: 'Instant Storefronts',
    body: 'Create a professional digital catalogue in minutes. Upload pictures, set your prices, and go live without writing a single line of code.',
  },
  {
    num: '02',
    title: 'Direct Message Checkout',
    body: 'No anonymous cart checkouts. Buyers chat with you directly on WhatsApp, Instagram, or Telegram. Own your customer relationship.',
  },
  {
    num: '03',
    title: 'Zero Commissions',
    body: 'No middleman taking a cut of your hard work. Every rupee you charge is paid directly to you. What you sell is what you keep.',
  },
  {
    num: '04',
    title: 'Transparent Trust Scores',
    body: 'Our reputation engine rewards reliable sellers. Deliver orders, grow your rating, and gain organic buyer confidence.',
  },
  {
    num: '05',
    title: 'Organic Discovery',
    body: 'Get discovered without massive ad spend. Your products organically surface on the Seyon marketplace and category listings.',
  },
  {
    num: '06',
    title: 'Premium Custom Design',
    body: 'Storefront templates designed to look premium by default. Showcase your craftsmanship with the elegance it deserves.',
  },
];

const STATS = [
  { value: '5 Min', label: 'Setup Time' },
  { value: '₹0', label: 'Commissions' },
  { value: '100%', label: 'Ownership' },
  { value: 'Unlimited', label: 'Inventory' },
];

const STEPS = [
  {
    title: 'Claim your brand link',
    body: 'Create your account and claim your custom Seyon URL. Set up your branding and biography in seconds.',
  },
  {
    title: 'Upload your creations',
    body: 'List your items with descriptions and pricing options, and organize them into curated galleries.',
  },
  {
    title: 'Connect checkout routes',
    body: 'Paste your storefront link on Instagram, WhatsApp, or anywhere you interact with your community.',
  },
  {
    title: 'Receive orders in chat',
    body: 'Buyers tap to purchase and land directly in your messaging app of choice to complete payment directly.',
  },
];

const FAQS = [
  {
    q: 'How do I start selling on Seyon?',
    a: 'Simply sign up, claim your brand name, and add your first product. Your storefront goes live immediately without needing any developer help.',
  },
  {
    q: 'Is it really free? Where is the catch?',
    a: 'Yes, Seyon is 100% free to start. We take zero commissions on your sales and do not intercept payments. Transactions happen directly between you and your buyer.',
  },
  {
    q: 'How do buyers pay and order?',
    a: 'Buyers browse your custom storefront, select items, and click order. They are redirected to your WhatsApp, Instagram, or Telegram chat with pre-filled order details. You handle the transaction over UPI, cash, or card.',
  },
  {
    q: 'What is the trust score and how does it work?',
    a: 'It is a public score showing buyer satisfaction and order completion. Honest, fast-responding sellers build up their score and get higher visibility in search listings.',
  },
];

const ArrowDiagonal = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="inline-block ml-1 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
  >
    <line x1="7" y1="17" x2="17" y2="7" />
    <polyline points="7 7 17 7 17 17" />
  </svg>
);

const ArrowRight = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="inline-block ml-1.5 transition-transform duration-300 group-hover:translate-x-1"
  >
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

export default function AboutPage() {
  return (
    <div className="relative w-full overflow-hidden bg-black text-zinc-300 min-h-screen font-sans">
      {/* Custom CSS Animation Styles Stylesheet */}
      <style>{`
        @keyframes subtlePulse {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.3; }
        }
        @keyframes horizontalSweep {
          0% { transform: translateX(-100%); }
          50%, 100% { transform: translateX(100%); }
        }
        @keyframes borderShine {
          0%, 100% {
            border-color: rgba(229, 192, 123, 0.15);
            box-shadow: 0 0 4px rgba(229, 192, 123, 0.02);
          }
          50% {
            border-color: rgba(229, 192, 123, 0.55);
            box-shadow: 0 0 16px rgba(229, 192, 123, 0.12);
          }
        }
        @keyframes floatEffect {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .glow-sweep-active {
          position: relative;
          overflow: hidden;
        }
        .glow-sweep-active::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 50%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(229, 192, 123, 0.08), transparent);
          transform: skewX(-20deg);
          animation: horizontalSweep 6s infinite ease-in-out;
        }
        .animate-manifesto-badge {
          animation: borderShine 3s infinite ease-in-out;
        }
        .animate-float {
          animation: floatEffect 6s ease-in-out infinite;
        }
        /* Details opening transition block */
        details[open] summary ~ * {
          animation: customFadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Architectural Grid Lines (Subtle Luxury Layout) */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-0 bottom-0 left-[10%] w-px bg-zinc-900/30" />
        <div className="absolute top-0 bottom-0 left-[50%] w-px bg-zinc-900/20" />
        <div className="absolute top-0 bottom-0 right-[10%] w-px bg-zinc-900/30" />
        <div className="absolute inset-0 opacity-[0.012] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      {/* Premium Back-Glow Ambient Spotlights */}
      <div className="pointer-events-none absolute -top-80 left-1/2 -translate-x-1/2 w-[1100px] h-[1100px] bg-yellow-500/5 rounded-full blur-[200px]" />
      <div className="pointer-events-none absolute top-[35%] right-[5%] w-[700px] h-[700px] bg-[#E5C07B]/3 rounded-full blur-[180px]" />
      <div className="pointer-events-none absolute bottom-[15%] left-[5%] w-[700px] h-[700px] bg-[#9C752B]/3 rounded-full blur-[180px]" />

      <div className="relative z-10">
        {/* HERO SECTION */}
        <section className="max-w-7xl mx-auto px-6 pt-28 sm:pt-40 pb-24 border-b border-zinc-900">
          <div className="grid lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-7 space-y-8">
              <Reveal>
                <span className="animate-manifesto-badge inline-flex items-center rounded-full border border-zinc-800 bg-zinc-950/45 px-5 py-2 text-[11px] font-black uppercase tracking-[0.3em] text-[#E5C07B]">
                  THE SEYON MANIFESTO
                </span>
              </Reveal>

              <Reveal delay={80}>
                <h1 className="text-left text-5xl sm:text-7xl md:text-8xl font-extralight tracking-tighter text-white leading-[0.95] uppercase">
                  Commerce <br />
                  <span className="font-black bg-gradient-to-r from-[#E5C07B] via-[#D1A751] to-[#9C752B] bg-clip-text text-transparent">
                    set free
                  </span>
                </h1>
              </Reveal>
            </div>

            <div className="lg:col-span-5 lg:pt-16 space-y-8">
              <Reveal delay={160}>
                <p className="text-zinc-400 text-lg sm:text-xl font-light leading-relaxed">
                  Seyon empowers independent artisans, creators, and home-run brands across India. 
                  Get a premium storefront, skip the high commissions, and connect directly with your buyers 
                  where they already are.
                </p>
              </Reveal>

              <Reveal delay={240}>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <Link
                    href="/login?callbackUrl=/dashboard"
                    className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#E5C07B] via-[#D1A751] to-[#9C752B] px-9 py-4.5 text-xs font-black text-black tracking-[0.15em] uppercase transition-all duration-500 hover:shadow-[0_0_35px_rgba(229,192,123,0.35)] hover:-translate-y-1 active:scale-95"
                  >
                    Set Up Your Store
                    <ArrowRight />
                  </Link>
                  <Link
                    href="/marketplace"
                    className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-black px-9 py-4.5 text-xs font-bold text-white tracking-[0.15em] uppercase transition-all duration-300 hover:border-[#E5C07B]/40 hover:bg-zinc-950 active:scale-95"
                  >
                    Explore Marketplace
                    <ArrowDiagonal />
                  </Link>
                </div>
              </Reveal>
            </div>
          </div>

          <Reveal delay={320}>
            <div className="mt-20 flex flex-col sm:flex-row sm:items-center gap-y-3 gap-x-8 text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500 border-t border-zinc-900/60 pt-8">
              <span>LIVE IN 5 MINUTES</span>
              <span className="hidden sm:inline text-zinc-800">•</span>
              <span>WHATSAPP · INSTAGRAM · TELEGRAM</span>
              <span className="hidden sm:inline text-zinc-800">•</span>
              <span>0% COMMISSIONS, FOREVER</span>
            </div>
          </Reveal>
        </section>

        {/* THE MANIFESTO: SPLIT COMPASS */}
        <section className="bg-gradient-to-b from-black to-[#050506] py-24 sm:py-32 border-b border-zinc-900">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid lg:grid-cols-12 gap-12 lg:gap-20 items-start">
              {/* The Old Way Card */}
              <div className="lg:col-span-5 relative group overflow-hidden rounded-3xl border border-zinc-900 bg-zinc-950/20 p-8 sm:p-12 transition-all duration-500 hover:border-zinc-850 hover:bg-zinc-950/30">
                <Reveal>
                  <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-zinc-600">
                    The Industry Standard
                  </span>
                  <h3 className="mt-4 text-3xl font-extralight text-zinc-400 uppercase tracking-tight">
                    Broken Checkouts. <br />
                    <span className="font-bold text-zinc-200">High Cuts.</span>
                  </h3>
                  <div className="mt-8 space-y-5 text-sm text-zinc-500 leading-relaxed font-light">
                    <p className="flex items-start gap-4">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-800 mt-2 shrink-0" />
                      Marketplaces take a massive 15% to 30% commission cut on your hard work.
                    </p>
                    <p className="flex items-start gap-4">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-800 mt-2 shrink-0" />
                      Anonymous checkout loops dissociate buyers from the creator&apos;s real identity.
                    </p>
                    <p className="flex items-start gap-4">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-800 mt-2 shrink-0" />
                      Your customer contacts are locked away inside high-friction corporate platforms.
                    </p>
                  </div>
                </Reveal>
              </div>

              <div className="lg:col-span-2 flex justify-center py-6 lg:py-16">
                <span className="font-serif text-3xl italic text-[#E5C07B]/20">vs</span>
              </div>

              {/* The Seyon Way Card */}
              <div className="glow-sweep-active lg:col-span-5 relative group overflow-hidden rounded-3xl border border-[#E5C07B]/10 bg-gradient-to-b from-[#0a0a0c] to-black p-8 sm:p-12 transition-all duration-550 hover:border-[#E5C07B]/35 hover:-translate-y-1 hover:shadow-[0_15px_40px_rgba(229,192,123,0.04)]">
                {/* Subtle top indicator line */}
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#E5C07B]/30 to-transparent" />
                
                <Reveal delay={100}>
                  <span className="text-[11px] font-black uppercase tracking-[0.25em] text-[#E5C07B]">
                    The Seyon Paradigm
                  </span>
                  <h3 className="mt-4 text-3xl font-extralight text-white uppercase tracking-tight">
                    Direct Connections. <br />
                    <span className="font-bold bg-gradient-to-r from-[#E5C07B] to-[#D1A751] bg-clip-text text-transparent">
                      100% Margin.
                    </span>
                  </h3>
                  <div className="mt-8 space-y-5 text-sm text-zinc-355 leading-relaxed font-light">
                    <p className="flex items-start gap-4">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E5C07B] mt-2 shrink-0" />
                      0% commissions. Transactions happen direct between you and your customers.
                    </p>
                    <p className="flex items-start gap-4">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E5C07B] mt-2 shrink-0" />
                      Orders route straight to chat on WhatsApp, Instagram, or Telegram.
                    </p>
                    <p className="flex items-start gap-4">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E5C07B] mt-2 shrink-0" />
                      Build organic brand reputation with verified, decentralized reputation scores.
                    </p>
                  </div>
                </Reveal>
              </div>
            </div>
          </div>
        </section>

        {/* TRUST ROW / CATEGORIES */}
        <section className="max-w-7xl mx-auto px-6 py-16 text-center border-b border-zinc-900/60">
          <Reveal>
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-600 mb-6">
              Supporting Makers in Every Niche
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {CATEGORIES.map((c) => (
                <span
                  key={c}
                  className="rounded-xl border border-zinc-900 bg-zinc-950/60 px-5 py-2 text-xs font-bold text-zinc-400 transition-all duration-300 hover:text-[#E5C07B] hover:border-[#E5C07B]/30 hover:scale-[1.03]"
                >
                  {c}
                </span>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ASYMMETRICAL SUPERPOWERS GRID */}
        <section className="max-w-7xl mx-auto px-6 py-24 sm:py-32 border-b border-zinc-900">
          <Reveal className="text-center mb-20">
            <span className="text-[11px] font-black uppercase tracking-[0.25em] text-[#E5C07B]">
              Platform Architecture
            </span>
            <h2 className="mt-4 text-4xl sm:text-6xl font-black text-white uppercase tracking-tight">
              Designed for direct growth
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-zinc-400 text-base sm:text-lg font-light">
              Everything you need to turn standard direct messages into a premium brand experience.
            </p>
          </Reveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {FEATURES.map((f, i) => {
              return (
                <Reveal key={f.title} delay={(i % 3) * 80}>
                  <div className="group relative h-full rounded-3xl border border-zinc-900 bg-gradient-to-b from-[#0a0a0c] to-[#040405] p-8 sm:p-10 transition-all duration-500 hover:border-[#E5C07B]/25 hover:-translate-y-2 hover:shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
                    <span className="block text-4xl sm:text-5xl font-mono font-extralight text-[#E5C07B]/20 group-hover:text-[#E5C07B]/60 transition-colors duration-500 mb-6">
                      {f.num}
                    </span>
                    <h3 className="text-lg font-bold text-white mb-3 group-hover:text-[#E5C07B] transition-colors duration-300">{f.title}</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed font-light">{f.body}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* QUANTIFIED METRICS (STATS) */}
        <section className="bg-zinc-950/20 border-b border-zinc-900 py-20">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {STATS.map((s, i) => {
                return (
                  <Reveal key={s.label} delay={i * 80}>
                    <div className="text-center group space-y-2">
                      <p className="text-4xl sm:text-5xl font-extralight tracking-tight text-[#E5C07B] font-mono group-hover:scale-105 group-hover:brightness-110 transition-all duration-500">
                        {s.value}
                      </p>
                      <p className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.25em]">
                        {s.label}
                      </p>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* TIMELINE: HOW IT WORKS */}
        <section className="max-w-4xl mx-auto px-6 py-24 sm:py-32 border-b border-zinc-900">
          <Reveal className="text-center mb-20">
            <span className="text-[11px] font-black uppercase tracking-[0.25em] text-[#E5C07B]">
              The Journey
            </span>
            <h2 className="mt-4 text-4xl sm:text-6xl font-black text-white uppercase tracking-tight">
              Get live in four steps
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-zinc-400 text-sm sm:text-base font-light">
              No technical barrier. From signing up to sending order details directly to chat.
            </p>
          </Reveal>

          <div className="relative space-y-12 pl-8 sm:pl-16 border-l border-zinc-900 ml-4 sm:ml-12">
            {/* Elegant gradient timeline connector */}
            <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-[#E5C07B]/30 via-zinc-800 to-transparent" />
            
            {STEPS.map((s, i) => {
              return (
                <Reveal key={s.title} delay={i * 80}>
                  <div className="relative group/timeline bg-zinc-950/20 rounded-3xl border border-zinc-900 p-8 hover:border-[#E5C07B]/20 hover:bg-zinc-950/40 hover:-translate-y-1 transition-all duration-500">
                    {/* timeline node icon/number */}
                    <span className="absolute -left-[3.1rem] sm:-left-[5.1rem] top-8 flex h-10 w-10 items-center justify-center rounded-xl bg-black border border-zinc-850 text-[#E5C07B] text-xs font-black font-mono shadow-xl transition-all duration-500 group-hover/timeline:scale-110 group-hover/timeline:border-[#E5C07B]/50 group-hover/timeline:bg-[#E5C07B] group-hover/timeline:text-black">
                      {i + 1}
                    </span>
                    <h3 className="text-lg font-bold text-white mb-2 group-hover/timeline:text-[#E5C07B] transition-colors duration-300 uppercase tracking-wider">
                      {s.title}
                    </h3>
                    <p className="text-sm text-zinc-400 leading-relaxed font-light">{s.body}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* SELLER STORIES (CASE STUDIES) */}
        <section className="max-w-7xl mx-auto px-6 py-24 sm:py-32 border-b border-zinc-900">
          <Reveal className="text-center mb-16">
            <span className="text-[11px] font-black uppercase tracking-[0.25em] text-[#E5C07B]">
              Case Studies
            </span>
            <h2 className="mt-4 text-4xl sm:text-6xl font-black text-white uppercase tracking-tight">
              Real brands. Direct sales.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-zinc-400 text-base font-light">
              Learn how small businesses transitioned from chaotic comment threads to structured direct orders.
            </p>
          </Reveal>
          <Reveal delay={100}>
            <CaseStudies />
          </Reveal>
        </section>

        {/* Accordion FAQ Section */}
        <section className="max-w-4xl mx-auto px-6 py-24 sm:py-32 border-b border-zinc-900">
          <Reveal className="text-center mb-16">
            <span className="text-[11px] font-black uppercase tracking-[0.25em] text-[#E5C07B]">
              Questions
            </span>
            <h2 className="mt-4 text-4xl sm:text-6xl font-black text-white uppercase tracking-tight">
              Frequently Asked
            </h2>
          </Reveal>

          <div className="space-y-4">
            {FAQS.map((item, i) => (
              <Reveal key={item.q} delay={(i % 2) * 60}>
                <details className="group rounded-3xl border border-zinc-900 bg-zinc-950/10 px-8 transition-all duration-300 open:bg-[#0a0a0c]/60 open:border-[#E5C07B]/20">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-6 text-base sm:text-lg font-bold text-white [&::-webkit-details-marker]:hidden transition-colors duration-300 hover:text-[#E5C07B]">
                    {item.q}
                    <ChevronDown className="h-5 w-5 shrink-0 text-[#E5C07B] transition-transform duration-550 group-open:rotate-180" />
                  </summary>
                  <p className="pb-6 pr-6 text-sm sm:text-base text-zinc-400 leading-relaxed font-light">
                    {item.a}
                  </p>
                </details>
              </Reveal>
            ))}
          </div>
        </section>

        {/* FINAL CTA SECTION */}
        <section className="max-w-7xl mx-auto px-6 pt-16 pb-36">
          <Reveal>
            <div className="relative overflow-hidden rounded-[2.5rem] border border-zinc-900 bg-[#060608] p-12 sm:p-24 text-center shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
              {/* Glowing gradient backwash */}
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(229,192,123,0.1),transparent_60%)]" />
              
              <div className="relative z-10 space-y-8">
                <span className="inline-flex items-center rounded-full border border-zinc-800 bg-zinc-950/50 px-5 py-2 text-[11px] font-black uppercase tracking-[0.3em] text-[#E5C07B]">
                  JOIN SEYON
                </span>
                
                <h2 className="mx-auto max-w-4xl text-4xl sm:text-6xl md:text-7xl font-extralight text-white uppercase tracking-tight leading-[0.95]">
                  Claim your brand <br />
                  <span className="font-black bg-gradient-to-r from-[#E5C07B] via-[#D1A751] to-[#9C752B] bg-clip-text text-transparent">
                    storefront today
                  </span>
                </h2>
                
                <p className="mx-auto max-w-xl text-zinc-400 font-light text-base sm:text-lg leading-relaxed">
                  Start selling beautiful craft items, clothing, or homemade goods with zero commission. 
                  Get your Seyon link live right now.
                </p>
                
                <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Link
                    href="/login?callbackUrl=/dashboard"
                    className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#E5C07B] via-[#D1A751] to-[#9C752B] px-9 py-4.5 text-xs font-black text-black tracking-[0.15em] uppercase transition-all duration-500 hover:shadow-[0_0_35px_rgba(229,192,123,0.35)] hover:-translate-y-1 active:scale-95"
                  >
                    Set Up Your Store
                    <ArrowRight />
                  </Link>
                  <Link
                    href="/marketplace"
                    className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-[#060608] px-9 py-4.5 text-xs font-bold text-white tracking-[0.15em] uppercase transition-all duration-300 hover:border-[#E5C07B]/40 hover:bg-black active:scale-95"
                  >
                    Explore Marketplace
                    <ArrowDiagonal />
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </div>
    </div>
  );
}
