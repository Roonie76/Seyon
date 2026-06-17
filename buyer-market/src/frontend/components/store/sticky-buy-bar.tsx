'use client';

import * as React from 'react';
import { MessageCircle, PackageX } from 'lucide-react';
import { trackEvent } from '@/actions/analytics';
import { buildOrderMessage } from '@/shared/lib/order-message';

interface StickyBuyBarProps {
  shopId: string;
  whatsappNumber: string;
  shopName: string;
  productId: string;
  productName: string;
  price: number;
  compareAtPrice?: number | null;
  productUrl: string;
  inStock: boolean;
  shopPaused?: boolean;
}

/**
 * Mobile-only bottom bar so the order button is always one thumb-tap away.
 * Most chat-commerce traffic is mobile; making buyers scroll back up to the
 * CTA costs orders.
 */
export function StickyBuyBar({
  shopId,
  whatsappNumber,
  shopName,
  productId,
  productName,
  price,
  compareAtPrice,
  productUrl,
  inStock,
  shopPaused = false,
}: StickyBuyBarProps) {
  const handleClick = async () => {
    try {
      await trackEvent(shopId, 'WHATSAPP_CLICK', productId);
    } catch (error) {
      console.error('Analytics tracking failed:', error);
    }
    const text = buildOrderMessage({ productName, shopName, price, productUrl, selections: {}, inStock });
    let cleanNumber = whatsappNumber.replace(/[^\d]/g, '');
    if (cleanNumber.length === 10) {
      cleanNumber = `91${cleanNumber}`;
    }
    window.open(`https://wa.me/${cleanNumber}?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (shopPaused) return null;

  const onSale = compareAtPrice != null && compareAtPrice > price;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 lg:hidden border-t border-zinc-200 bg-white/95 backdrop-blur-sm px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] flex items-center justify-between gap-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="min-w-0">
        <p className="text-[10px] uppercase font-bold text-muted-foreground truncate">{productName}</p>
        <p className="text-lg font-black text-foreground leading-tight flex items-baseline gap-1.5">
          ₹{price.toFixed(2)}
          {onSale && compareAtPrice != null && (
            <span className="text-xs font-normal text-muted-foreground line-through">₹{compareAtPrice.toFixed(2)}</span>
          )}
        </p>
      </div>
      {inStock ? (
        <button
          type="button"
          onClick={handleClick}
          className="shrink-0 inline-flex items-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-sm font-bold px-5 py-2.5 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
        >
          <MessageCircle className="h-4 w-4" /> Chat to Buy
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="shrink-0 inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white text-zinc-700 text-sm font-bold px-5 py-2.5 transition-all cursor-pointer"
        >
          <PackageX className="h-4 w-4" /> Ask seller
        </button>
      )}
    </div>
  );
}
