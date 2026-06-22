'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, PackageX, ShoppingCart, Check } from 'lucide-react';
import { trackEvent } from '@/actions/analytics';
import { parseOptions, buildOrderMessage } from '@/shared/lib/order-message';
import { getLocalCart, saveLocalCart, getSelectionsKey, StoreCartWidget } from './store-cart';

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
  imageUrl?: string;
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
  imageUrl,
}: ProductCTAProps) {
  const groups = React.useMemo(() => (options ? parseOptions(options) : []), [options]);
  const [selections, setSelections] = React.useState<Record<string, string>>({});
  const [added, setAdded] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleAddToCart = () => {
    if (groups.length > 0) {
      const missing = groups.filter((g) => !selections[g.label ?? '_']);
      if (missing.length > 0) {
        setError(`Please select: ${missing.map((m) => m.label).join(', ')}`);
        setTimeout(() => setError(null), 3000);
        return;
      }
    }

    const selectionsKey = getSelectionsKey(selections);
    const cart = getLocalCart(shopId);

    const existingIndex = cart.findIndex(
      (item) => item.productId === productId && item.selectionsKey === selectionsKey
    );

    if (existingIndex > -1) {
      cart[existingIndex].quantity += 1;
    } else {
      cart.push({
        productId,
        title: productName,
        price,
        image: imageUrl,
        quantity: 1,
        selections,
        selectionsKey,
      });
    }

    saveLocalCart(shopId, cart);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

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
    let cleanNumber = whatsappNumber.replace(/[^\d]/g, '');
    if (cleanNumber.length === 10) {
      cleanNumber = `91${cleanNumber}`;
    }
    const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(text)}`;
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

      {error && (
        <span className="text-xs font-bold text-red-500 animate-pulse block">
          {error}
        </span>
      )}

      {inStock ? (
        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={handleAddToCart}
            className={`w-full h-12 rounded-lg text-sm font-extrabold uppercase tracking-wide border flex items-center justify-center gap-2 transition-all duration-300 active:scale-95 cursor-pointer shadow-sm ${
              added
                ? 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600'
                : 'bg-amber-500 hover:bg-amber-400 text-black border-amber-600'
            }`}
          >
            {added ? (
              <>
                <Check className="h-4 w-4" /> Added to Cart
              </>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4" /> Add to Cart
              </>
            )}
          </button>
          <Button
            onClick={handleClick}
            variant="whatsapp"
            size="lg"
            className="w-full justify-center gap-2 text-sm uppercase font-extrabold tracking-wide rounded-lg h-12"
          >
            <MessageCircle className="h-5 w-5" /> Chat on WhatsApp
          </Button>
        </div>
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

      <StoreCartWidget
        shopId={shopId}
        shopName={shopName}
        whatsappNumber={whatsappNumber}
      />
    </div>
  );
}
