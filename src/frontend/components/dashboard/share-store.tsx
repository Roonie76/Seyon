'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Copy, Check, Share2, MessageCircle, Send, Download } from 'lucide-react';
import QRCode from 'qrcode';

interface ShareStoreCardProps {
  shopSlug: string;
  buyerMarketUrl?: string;
}

export function ShareStoreCard({ shopSlug, buyerMarketUrl }: ShareStoreCardProps) {
  const [storeUrl, setStoreUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    let base = buyerMarketUrl;
    if (!base && typeof window !== 'undefined') {
      const origin = window.location.origin;
      if (origin.includes('seller') || origin.includes('3001') || origin.includes('3002')) {
        base = 'https://seyon-pied.vercel.app';
      } else {
        base = origin;
      }
    }
    setStoreUrl(`${base || 'https://seyon-pied.vercel.app'}/store/${shopSlug}`);
  }, [shopSlug, buyerMarketUrl]);

  useEffect(() => {
    if (!storeUrl) return;
    QRCode.toDataURL(storeUrl, { width: 480, margin: 2, color: { dark: '#18181b', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch((err: unknown) => console.error('QR generation failed:', err));
  }, [storeUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(storeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <Card className="glass relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[150px] h-[150px] bg-primary/5 rounded-full blur-[60px] pointer-events-none" />
      <CardHeader>
        <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
          <Share2 className="h-5 w-5 text-primary" /> Promote Your Store
        </CardTitle>
        <CardDescription>
          Share your dedicated store URL on social media to start receiving orders directly on WhatsApp.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-grow">
            <Input
              value={storeUrl}
              readOnly
              className="pr-10 bg-zinc-50 border-zinc-200 text-zinc-800 text-xs font-mono h-10 select-all"
            />
          </div>
          <Button
            onClick={handleCopy}
            variant="outline"
            className="h-10 text-xs font-semibold px-4 min-w-[100px] gap-1.5 transition-all duration-300"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-600 animate-scale-in" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy Link
              </>
            )}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-100">
          <span className="text-[10px] uppercase font-bold text-muted-foreground block w-full mb-1">
            Quick Share
          </span>
          <a
            href={`https://api.whatsapp.com/send?text=Check%20out%20my%20store%20on%20Seyon%21%20${encodeURIComponent(storeUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-zinc-250 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-800 transition-colors"
          >
            <MessageCircle className="h-3.5 w-3.5 text-emerald-600" /> WhatsApp
          </a>
          <a
            href={`https://t.me/share/url?url=${encodeURIComponent(storeUrl)}&text=Check%20out%20my%20store%20on%20Seyon%21`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-zinc-250 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-800 transition-colors"
          >
            <Send className="h-3.5 w-3.5 text-blue-500" /> Telegram
          </a>
        </div>

        {/* QR code: print it, stick it in an Instagram bio highlight, or share it on stories */}
        {qrDataUrl && (
          <div className="flex items-center gap-4 pt-3 border-t border-zinc-100">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL, not a remote asset */}
            <img
              src={qrDataUrl}
              alt={`QR code linking to your storefront at ${storeUrl}`}
              className="h-24 w-24 rounded-md border border-zinc-200 bg-white p-1 shrink-0"
            />
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Buyers scan this to open your store. Add it to your Instagram bio highlight, story, or print it for your packaging.
              </p>
              <a
                href={qrDataUrl}
                download={`seyon-store-${shopSlug}-qr.png`}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-800 w-fit"
              >
                <Download className="h-3.5 w-3.5" /> Download QR (PNG)
              </a>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
