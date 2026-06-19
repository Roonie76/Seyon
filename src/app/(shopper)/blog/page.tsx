import { Card, CardContent } from '@/components/ui/card';
import { PenLine, Calendar, ArrowRight } from 'lucide-react';
import { BackButton } from '@/components/shared/back-button';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Insights, guides, and stories from Seyon — learn about social commerce, setting up your store, and building buyer trust.',
};

const posts = [
  {
    slug: 'why-social-commerce-is-the-future',
    title: 'Why Social Commerce is the Future',
    date: 'June 15, 2026',
    excerpt:
      'The way people buy and sell is shifting. Social commerce — where discovery, trust, and transactions happen through messaging apps — is growing faster than traditional e-commerce in emerging markets.',
    content: `Social commerce removes the friction of traditional online shopping. Instead of navigating checkout flows, entering card details, and waiting for confirmation emails, buyers simply message a seller directly on WhatsApp.

This model works because it mirrors how commerce has always worked in India — through relationships, conversation, and trust. A buyer asks questions, negotiates, and confirms an order in a single chat thread.

For sellers, social commerce means zero upfront costs. No website hosting fees, no payment gateway commissions, no inventory management software. Just a phone, a product, and a WhatsApp number.

Seyon bridges the gap by giving these sellers a discoverable storefront while preserving the simplicity of direct messaging. It's the best of both worlds — the reach of e-commerce with the intimacy of local bazaar shopping.`,
  },
  {
    slug: 'setup-your-seyon-store-in-5-minutes',
    title: 'How to Set Up Your Seyon Store in 5 Minutes',
    date: 'June 10, 2026',
    excerpt:
      'A step-by-step guide to creating your first storefront on Seyon — from sign-up to listing your first product.',
    content: `Getting started on Seyon is designed to be fast and painless. Here's a quick walkthrough:

Step 1: Sign Up — Create a free seller account using your email or Google account. No approval process — your account is active immediately.

Step 2: Set Up Your Store — Choose a store name, write a short description, and upload your logo. This becomes your public storefront that buyers can browse.

Step 3: Add Your WhatsApp Number — This is how buyers will reach you. When someone clicks "Chat to Buy", they'll be redirected to WhatsApp with a pre-filled message.

Step 4: List Your First Product — Add a title, description, price, category, and photos. Your product goes live instantly and becomes searchable on the Seyon marketplace.

Step 5: Share Your Store Link — Copy your unique store URL and share it on Instagram, WhatsApp Status, or any social platform. Every view is a potential customer.

That's it. Five minutes, zero cost, and you have a professional storefront ready to receive orders.`,
  },
  {
    slug: 'building-trust-with-buyers-online',
    title: 'Building Trust with Buyers Online',
    date: 'June 5, 2026',
    excerpt:
      'Trust is the currency of social commerce. Learn how to build credibility, earn positive reviews, and increase your Trust Score on Seyon.',
    content: `When you're selling through messaging apps, trust is everything. Buyers can't physically examine your product, so they rely on signals — your store's reputation, product photos, reviews, and responsiveness.

Here's how to build trust on Seyon:

Use High-Quality Photos — Clear, well-lit product images are the single most important factor in earning buyer confidence. Show multiple angles and include size references.

Write Honest Descriptions — Don't oversell. Accurate descriptions lead to satisfied buyers, which leads to positive reviews. Mention materials, dimensions, and any imperfections.

Respond Quickly — When a buyer messages you on WhatsApp, respond within minutes if possible. Fast replies signal professionalism and reliability.

Encourage Reviews — After a successful sale, ask your buyer to leave a review on Seyon. Reviews directly impact your Trust Score and search ranking.

Be Transparent About Shipping — Set clear expectations about delivery timelines, shipping costs, and return policies upfront. Surprises erode trust.

Your Trust Score on Seyon reflects all of these factors. A higher score means better visibility in search results and more buyers reaching out to you.`,
  },
];

export default function BlogPage() {
  return (
    <div className="flex-1 py-16 px-4 relative max-w-4xl mx-auto w-full">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />

      <BackButton fallbackHref="/marketplace" label="Back to Marketplace" className="mb-6" />

      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <PenLine className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-foreground">Blog</h1>
          <p className="text-xs text-muted-foreground">Insights, guides, and stories from Seyon</p>
        </div>
      </div>

      <div className="space-y-6">
        {posts.map((post) => (
          <Card key={post.slug} className="glass border-border shadow-2xl relative z-10 overflow-hidden group">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Calendar className="h-3.5 w-3.5" />
                <span>{post.date}</span>
              </div>

              <h2 className="text-xl font-bold text-white group-hover:text-amber-400 transition-colors">
                {post.title}
              </h2>

              <p className="text-sm text-zinc-400 leading-relaxed">
                {post.excerpt}
              </p>

              <details className="group/details">
                <summary className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-500 hover:text-amber-400 cursor-pointer transition-colors list-none">
                  Read full article
                  <ArrowRight className="h-3 w-3 group-open/details:rotate-90 transition-transform" />
                </summary>
                <div className="mt-4 pt-4 border-t border-zinc-800 text-sm text-zinc-300 leading-relaxed whitespace-pre-line">
                  {post.content}
                </div>
              </details>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
