import { Card, CardContent } from '@/components/ui/card';
import { HelpCircle } from 'lucide-react';
import { BackButton } from '@/components/shared/back-button';
import { generateFAQJSONLD, safeJsonLdStringify } from '@/lib/seo';
import { FAQAccordion } from './faq-accordion';
import { faqs } from './faqs-data';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FAQs',
  description:
    'Frequently asked questions about Seyon — how to create a store, how buying works, Trust Scores, and more.',
};

export default function FAQsPage() {
  const faqJsonLd = generateFAQJSONLD(faqs);

  return (
    <div className="flex-1 py-16 px-4 relative max-w-4xl mx-auto w-full">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(faqJsonLd) }}
      />

      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />

      <BackButton fallbackHref="/marketplace" label="Back to Marketplace" className="mb-6" />

      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <HelpCircle className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-foreground">Frequently Asked Questions</h1>
          <p className="text-xs text-muted-foreground">Everything you need to know about Seyon</p>
        </div>
      </div>

      <Card className="glass border-border shadow-2xl relative z-10">
        <CardContent className="pt-6 space-y-6">
          <FAQAccordion />

          <section className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-1">
            <p className="text-xs font-semibold text-amber-400">💬 Still have questions?</p>
            <p className="text-xs text-zinc-400">
              Can&apos;t find what you&apos;re looking for? Reach out to us on our{' '}
              <a href="/contact" className="text-amber-400 hover:text-amber-300 underline underline-offset-2">
                Contact page
              </a>{' '}
              and we&apos;ll get back to you within 24 hours.
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
