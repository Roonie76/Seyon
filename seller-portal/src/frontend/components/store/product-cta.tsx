'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, PackageX } from 'lucide-react';
import { trackEvent } from '@/actions/analytics';
import { parseOptions, buildOrderMessage } from '@/shared/lib/order-message';

interface ProductCTAProps {
  shopId: string;
  whatsappNumber: string;
  shopName: string;
  productId: string;
  productName: string;
  price: number;
  productUrl: string;
  /** Free-text option groups, e.g. "Sizes: S, M, L · Colors: Red, Black" */
  options?: string | null;
  inStock: boolean;
  /** Shop vacation mode: disables ordering entirely. */
  shopPaused?: boolean;
}

export function ProductCTA({
  shopId,
  whatsappNumber,
  shopName,
  productId,
  productName,
  price,
  productUrl,
  options,
  inStock,
  shopPaused = false,
}: ProductCTAProps) {
  const groups = React.useMemo(() => (options ? parseOptions(options) : []), [options]);
  const [selections, setSelections] = React.useState<Record<string, string>>({});

  const selectValue = (groupLabel: string | null, value: string) => {
    const key = groupLabel ?? '_';
    setSelections((prev) => {
      if (prev[key] === value) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: value };
    });
  };

  const handleClick = async () => {
    try {
      await trackEvent(shopId, 'WHATSAPP_CLICK', productId);
    } catch (error) {
      console.error('Analytics tracking failed:', error);
    }

    const text = buildOrderMessage({ productName, shopName, price, productUrl, selections, inStock });
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
  };

  if (shopPaused) {
    return (
      <Button disabled variant="secondary" size="lg" className="w-full opacity-70 cursor-not-allowed">
        Seller is currently away
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      {inStock && groups.length > 0 && (
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <div key={group.label ?? '_'} className="flex flex-col gap-1.5">
              {group.label && (
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  {group.label}
                </span>
              )}
              <div className="flex flex-wrap gap-2">
                {group.values.map((value) => {
                  const selected = selections[group.label ?? '_'] === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => selectValue(group.label, value)}
                      aria-pressed={selected}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                        selected
                          ? 'bg-amber-500 text-black border-amber-600 shadow-sm'
                          : 'bg-white text-foreground border-zinc-300 hover:border-amber-400 hover:bg-amber-50'
                      }`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {inStock ? (
        <Button onClick={handleClick} variant="whatsapp" size="lg" className="w-full sm:w-auto">
          <MessageCircle className="h-5 w-5" /> Chat on WhatsApp
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-zinc-100 border border-zinc-200 text-zinc-600 text-sm font-bold w-fit">
            <PackageX className="h-4 w-4" /> Sold out
          </div>
          <Button onClick={handleClick} variant="outline" size="lg" className="w-full sm:w-auto">
            <MessageCircle className="h-5 w-5" /> Ask when it&apos;s back
          </Button>
        </div>
      )}
    </div>
  );
}
