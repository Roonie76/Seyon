import { Card, CardContent } from '@/components/ui/card';
import { Shield } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="flex-1 py-16 px-4 relative max-w-4xl mx-auto w-full">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Shield className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-foreground">Privacy Policy</h1>
          <p className="text-xs text-muted-foreground">Last updated: June 4, 2026</p>
        </div>
      </div>

      <Card className="glass border-border shadow-2xl relative z-10">
        <CardContent className="pt-6 space-y-6 text-sm text-zinc-300 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white">1. Information We Collect</h2>
            <p>
              We collect information you provide directly to us when you create an account, build a storefront, list products, or write a review. This may include your name, email address, phone number (for WhatsApp messaging redirect), Instagram username, Telegram username, and storefront description.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white">2. How We Use Information</h2>
            <p>
              We use the collected information to provision your storefront, connect you with buyers via WhatsApp, calculate trust scores, run category discovery search, moderate listings to prevent abuse or fraud, and compile web analytics (via PostHog).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white">3. Information Sharing and Disclosure</h2>
            <p>
              Seyon is a public storefront discovery engine. All storefront descriptions, product names, prices, categories, and social media handles (WhatsApp, Instagram, Telegram) you choose to list are made publicly accessible to prospective buyers. We do not sell or lease your private personal details.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white">4. Cookies and Analytics</h2>
            <p>
              We use cookies to maintain your active authentication session. Additionally, we capture user interactions and page visits using PostHog analytics to diagnose performance and improve discoverability.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white">5. Security</h2>
            <p>
              We take reasonable steps to secure your credentials and storefront data. However, please remember that no transmission over the internet or database storage is 100% secure.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white">6. Contact Us</h2>
            <p>
              If you have any questions or concerns about this Privacy Policy, please reach out to us at privacy@seyon.internal.
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
