import { Card, CardContent } from '@/components/ui/card';
import { Mail, MessageCircle } from 'lucide-react';
import { BackButton } from '@/components/shared/back-button';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Us',
  description:
    'Get in touch with the Seyon team. Reach us via email, WhatsApp, or social media — we typically respond within 24 hours.',
};

const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

const XIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const LinkedInIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

export default function ContactPage() {
  return (
    <div className="flex-1 py-16 px-4 relative max-w-4xl mx-auto w-full">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />

      <BackButton fallbackHref="/marketplace" label="Back to Marketplace" className="mb-6" />

      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Mail className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-foreground">Contact Us</h1>
          <p className="text-xs text-muted-foreground">We&apos;d love to hear from you</p>
        </div>
      </div>

      <Card className="glass border-border shadow-2xl relative z-10">
        <CardContent className="pt-6 space-y-8 text-sm text-zinc-300 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white">Get in Touch</h2>
            <p>
              Whether you have a question about selling on Seyon, need help with your storefront, 
              or want to report an issue — we&apos;re here to help. We typically respond within 24 hours.
            </p>
          </section>

          <div className="grid sm:grid-cols-2 gap-4">
            <a
              href="mailto:hello@seyon.in"
              className="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-2 hover:border-amber-500/30 transition-colors"
            >
              <div className="h-10 w-10 rounded-md bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                <Mail className="h-5 w-5 text-amber-500" />
              </div>
              <h3 className="text-sm font-bold text-white">Email</h3>
              <p className="text-xs text-zinc-400">hello@seyon.in</p>
              <p className="text-[10px] text-zinc-500">Best for general enquiries and partnerships</p>
            </a>

            <a
              href="https://wa.me/919876543210"
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-2 hover:border-emerald-500/30 transition-colors"
            >
              <div className="h-10 w-10 rounded-md bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                <MessageCircle className="h-5 w-5 text-emerald-500" />
              </div>
              <h3 className="text-sm font-bold text-white">WhatsApp</h3>
              <p className="text-xs text-zinc-400">+91 98765 43210</p>
              <p className="text-[10px] text-zinc-500">For quick support and urgent issues</p>
            </a>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white">Follow Us</h2>
            <p>Stay updated with new features, seller tips, and marketplace news.</p>
            <div className="flex items-center gap-4 pt-1">
              <a href="https://instagram.com/seyon.store" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-zinc-400 hover:text-pink-500 transition-colors">
                <InstagramIcon />
                <span className="text-xs">@seyon.store</span>
              </a>
              <a href="https://x.com/seyonstore" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
                <XIcon />
                <span className="text-xs">@seyonstore</span>
              </a>
              <a href="https://linkedin.com/company/seyon" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-zinc-400 hover:text-sky-500 transition-colors">
                <LinkedInIcon />
                <span className="text-xs">Seyon</span>
              </a>
            </div>
          </section>

          <section className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-1">
            <p className="text-xs font-semibold text-amber-400">🕐 Response Times</p>
            <p className="text-xs text-zinc-400">
              <strong className="text-zinc-300">Email:</strong> Within 24 hours (Mon–Sat) &nbsp;·&nbsp;
              <strong className="text-zinc-300">WhatsApp:</strong> Within 2 hours during business hours (10 AM – 7 PM IST)
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
