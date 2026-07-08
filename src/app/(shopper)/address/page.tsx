import { MapPin, Clock } from 'lucide-react';
import { BackButton } from '@/components/shared/back-button';
import { safeJsonLdStringify } from '@/lib/seo';
import { SITE_URL } from '@/lib/site';
import type { Metadata } from 'next';
import { PrivacyCallout } from '../privacy/_components/privacy-callout';

export const metadata: Metadata = {
  title: 'Company Address',
  description:
    'Find the registered office address and location of Seyon, the social-commerce storefront platform based in Gurgaon, Haryana.',
};

const addressJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Seyon',
  url: SITE_URL,
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Sector-92',
    addressLocality: 'Gurgaon',
    addressRegion: 'Haryana',
    postalCode: '122505',
    addressCountry: 'IN',
  },
};

export default function AddressPage() {
  return (
    <div className="flex-1 py-12 md:py-16 px-4 relative max-w-3xl mx-auto w-full bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(addressJsonLd) }}
      />

      <BackButton fallbackHref="/marketplace" label="Back to Marketplace" className="mb-6 text-zinc-650 hover:text-zinc-950 transition-colors" />

      {/* Header */}
      <div className="border-b border-zinc-200 pb-6 mb-8 select-none">
        <div className="mb-4">
          <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight font-serif">
            Company Address
          </h1>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl font-serif italic">
          Registered office address and business operations schedule for Seyon.
        </p>
      </div>

      {/* Main Content Area */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-8 relative z-10">
        {/* Section 1: Registered Office */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-zinc-950 font-serif border-b border-zinc-100 pb-2">Registered Office</h2>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-[#FAF4E9] border border-[#E9DEC6]/60 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin className="h-5.5 w-5.5 text-[#A77F3A]" />
              </div>
              <div className="space-y-1 text-sm text-zinc-600">
                <p className="font-bold text-zinc-950 text-base">Seyon</p>
                <p>Sector-92</p>
                <p>Gurgaon, Haryana 122505</p>
                <p className="font-semibold text-zinc-900">India</p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Business Hours */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-zinc-950 font-serif border-b border-zinc-100 pb-2">Business Hours</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#A77F3A]" />
                <p className="text-[10px] font-bold text-[#A77F3A] uppercase tracking-wider">Weekdays</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-sm text-zinc-950 font-bold">Monday – Friday</p>
                <p className="text-xs text-zinc-500 font-medium">10:00 AM – 7:00 PM IST</p>
              </div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#A77F3A]" />
                <p className="text-[10px] font-bold text-[#A77F3A] uppercase tracking-wider">Saturday</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-sm text-zinc-950 font-bold">Saturday</p>
                <p className="text-xs text-zinc-500 font-medium">10:00 AM – 2:00 PM IST</p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Postal Correspondence Callout */}
        <PrivacyCallout type="info">
          <p className="text-xs font-semibold text-zinc-950 mb-1">📬 Postal Correspondence</p>
          <p className="text-xs text-zinc-600 leading-relaxed">
            For any official correspondence or documents, please send to our registered office address above. 
            For faster responses, we recommend reaching out via our{' '}
            <a href="/contact" className="text-[#A77F3A] hover:underline font-bold">
              Contact page
            </a>.
          </p>
        </PrivacyCallout>
      </div>
    </div>
  );
}
