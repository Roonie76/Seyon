import { Card, CardContent } from '@/components/ui/card';
import { MapPin } from 'lucide-react';
import { BackButton } from '@/components/shared/back-button';
import { safeJsonLdStringify } from '@/lib/seo';
import { SITE_URL } from '@/lib/site';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Company Address',
  description:
    'Find the registered office address and location of Seyon, the social-commerce storefront platform based in Chennai, Tamil Nadu.',
};

const addressJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Seyon',
  url: SITE_URL,
  address: {
    '@type': 'PostalAddress',
    streetAddress: '42, Anna Salai, Triplicane',
    addressLocality: 'Chennai',
    addressRegion: 'Tamil Nadu',
    postalCode: '600005',
    addressCountry: 'IN',
  },
};

export default function AddressPage() {
  return (
    <div className="flex-1 py-16 px-4 relative max-w-4xl mx-auto w-full">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(addressJsonLd) }}
      />

      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />

      <BackButton fallbackHref="/marketplace" label="Back to Marketplace" className="mb-6" />

      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <MapPin className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-foreground">Company Address</h1>
          <p className="text-xs text-muted-foreground">Our registered office</p>
        </div>
      </div>

      <Card className="glass border-border shadow-2xl relative z-10">
        <CardContent className="pt-6 space-y-8 text-sm text-zinc-300 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white">Registered Office</h2>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-md bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="h-5 w-5 text-amber-500" />
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-white text-base">Seyon</p>
                  <p className="text-zinc-400">42, Anna Salai, Triplicane</p>
                  <p className="text-zinc-400">Chennai, Tamil Nadu 600005</p>
                  <p className="text-zinc-400">India</p>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white">Business Hours</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Weekdays</p>
                <p className="text-sm text-white font-medium">Monday – Friday</p>
                <p className="text-xs text-zinc-400">10:00 AM – 7:00 PM IST</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Saturday</p>
                <p className="text-sm text-white font-medium">Saturday</p>
                <p className="text-xs text-zinc-400">10:00 AM – 2:00 PM IST</p>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-1">
            <p className="text-xs font-semibold text-amber-400">📬 Postal Correspondence</p>
            <p className="text-xs text-zinc-400">
              For any official correspondence or documents, please send to our registered office address above. 
              For faster responses, we recommend reaching out via our{' '}
              <a href="/contact" className="text-amber-400 hover:text-amber-300 underline underline-offset-2">
                Contact page
              </a>.
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
