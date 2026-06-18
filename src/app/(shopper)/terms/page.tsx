import { Card, CardContent } from '@/components/ui/card';
import { FileText } from 'lucide-react';
import { BackButton } from '@/components/shared/back-button';

export default function TermsPage() {
  return (
    <div className="flex-1 py-16 px-4 relative max-w-4xl mx-auto w-full">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />

      <BackButton fallbackHref="/marketplace" label="Back to Marketplace" className="mb-6" />

      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <FileText className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-foreground">Terms of Service</h1>
          <p className="text-xs text-muted-foreground">Last updated: June 4, 2026</p>
        </div>
      </div>

      <Card className="glass border-border shadow-2xl relative z-10">
        <CardContent className="pt-6 space-y-6 text-sm text-zinc-300 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white">1. Acceptable Use</h2>
            <p>
              Seyon is a storefront and discovery platform. You agree not to list illegal products, counterfeit goods, or offensive services. Sellers are expected to represent their products truthfully.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white">2. Direct Customer Messaging</h2>
            <p>
              Seyon facilitates storefront indexing but does not manage billing, transactions, or delivery logistics. All trade agreements, transactions, and shipping arrangements occur directly between the seller and the buyer over WhatsApp, Instagram, or Telegram. Seyon holds no liability for dispute resolution or commercial failures.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white">3. Storefront Moderation and Trust Scores</h2>
            <p>
              Seyon reserves the right to suspend shops, delete listings, and adjust seller Trust Scores based on report flags, negative reviews, scam investigations, or platform policy violations.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white">4. User Accounts</h2>
            <p>
              You are responsible for keeping your credentials safe. You agree to notify us immediately if you suspect unauthorized activity under your seller credentials.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white">5. Disclaimer of Warranties</h2>
            <p>
              Seyon is provided &quot;as is&quot; and &quot;as available&quot;. We do not guarantee uninterrupted uptime, flawless discovery search ranking, or that your listings will generate sales.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white">6. Changes to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. Your continued use of the platform constitutes acceptance of updated terms.
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
