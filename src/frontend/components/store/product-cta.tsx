'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, PackageX, ShoppingCart, Check, ArrowRight, Info, ShieldCheck, Plus, Minus } from 'lucide-react';
import { trackEvent } from '@/actions/analytics';
import { track } from '@/frontend/lib/events';
import { parseOptions, buildOrderMessage } from '@/shared/lib/order-message';
import { getLocalCart, saveLocalCart, getSelectionsKey, StoreCartWidget, CartItem } from './store-cart';
import { useBodyScrollLock, useEscapeKey } from '@/frontend/lib/overlay';

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
  const [selections, setSelections] = React.useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (options) {
      const parsed = parseOptions(options);
      parsed.forEach((group) => {
        if (group.values.length > 0) {
          initial[group.label ?? '_'] = group.values[0];
        }
      });
    }
    return initial;
  });
  const [added, setAdded] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showGuidelines, setShowGuidelines] = React.useState(false);
  useBodyScrollLock(showGuidelines);
  useEscapeKey(showGuidelines, () => setShowGuidelines(false));
  const [showWhyLink, setShowWhyLink] = React.useState(false);
  const [cartItems, setCartItems] = React.useState<CartItem[]>(() => getLocalCart(shopId));

  React.useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.shopId === shopId) {
        setCartItems(getLocalCart(shopId));
      }
    };

    window.addEventListener('seyon-cart-updated', handleUpdate);
    return () => window.removeEventListener('seyon-cart-updated', handleUpdate);
  }, [shopId]);

  const currentSelectionsKey = React.useMemo(() => getSelectionsKey(selections), [selections]);

  const currentCartItem = React.useMemo(() => {
    return cartItems.find(
      (item) => item.productId === productId && item.selectionsKey === currentSelectionsKey
    );
  }, [cartItems, productId, currentSelectionsKey]);

  const currentQuantity = currentCartItem ? currentCartItem.quantity : 0;

  const validateSelections = (): boolean => {
    if (groups.length > 0) {
      const missing = groups.filter((g) => !selections[g.label ?? '_']);
      if (missing.length > 0) {
        setError(`Please select: ${missing.map((m) => m.label).join(', ')}`);
        setTimeout(() => setError(null), 3000);
        return false;
      }
    }
    return true;
  };

  const handleAddToCart = () => {
    if (!validateSelections()) return;

    const cart = getLocalCart(shopId);
    const existingIndex = cart.findIndex(
      (item) => item.productId === productId && item.selectionsKey === currentSelectionsKey
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
        selectionsKey: currentSelectionsKey,
      });
    }

    saveLocalCart(shopId, cart);
    setCartItems(cart);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const handleIncrement = () => {
    if (!validateSelections()) return;

    const cart = getLocalCart(shopId);
    const existingIndex = cart.findIndex(
      (item) => item.productId === productId && item.selectionsKey === currentSelectionsKey
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
        selectionsKey: currentSelectionsKey,
      });
    }

    saveLocalCart(shopId, cart);
    setCartItems(cart);
  };

  const handleDecrement = () => {
    const cart = getLocalCart(shopId);
    const existingIndex = cart.findIndex(
      (item) => item.productId === productId && item.selectionsKey === currentSelectionsKey
    );

    if (existingIndex > -1) {
      if (cart[existingIndex].quantity > 1) {
        cart[existingIndex].quantity -= 1;
      } else {
        cart.splice(existingIndex, 1);
      }
      saveLocalCart(shopId, cart);
      setCartItems(cart);
    }
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

  const handleRedirectToWhatsApp = async () => {
    setShowGuidelines(false);
    try {
      await trackEvent(shopId, 'WHATSAPP_CLICK', productId);
      // The moment that matters: a buyer actually reaching out to a seller.
      track('whatsapp_tapped', { shopId, productId: productId ?? null });
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

  const handleClick = () => {
    setShowGuidelines(true);
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
                <span className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider">
                  {group.label}
                </span>
              )}
              <div className="flex items-center flex-wrap gap-2 w-full">
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
                {groups[0] === group && (
                  <button
                    type="button"
                    onClick={() => setShowGuidelines(true)}
                    className="ml-auto text-xs font-bold text-[#A77F3A] hover:underline flex items-center gap-1 cursor-pointer select-none"
                  >
                    <Info className="h-3.5 w-3.5" />
                    <span>Guidelines</span>
                  </button>
                )}
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
          {currentQuantity > 0 ? (
            <div className="w-full h-12 rounded-lg bg-amber-500 border border-amber-600 shadow-sm flex items-center justify-between px-2 text-black transition-all duration-300">
              <button
                type="button"
                onClick={handleDecrement}
                aria-label="Decrease quantity"
                className="w-9 h-9 rounded-md bg-black/10 hover:bg-black/20 active:scale-90 flex items-center justify-center transition-all cursor-pointer select-none"
              >
                <Minus className="h-4 w-4 stroke-[2.5]" />
              </button>
              <div className="flex items-center gap-2 font-black text-sm select-none">
                <span className="text-base font-black">{currentQuantity}</span>
                <span className="text-[11px] uppercase font-extrabold text-black/75 tracking-wider">
                  in Cart
                </span>
              </div>
              <button
                type="button"
                onClick={handleIncrement}
                aria-label="Increase quantity"
                className="w-9 h-9 rounded-md bg-black/10 hover:bg-black/20 active:scale-90 flex items-center justify-center transition-all cursor-pointer select-none"
              >
                <Plus className="h-4 w-4 stroke-[2.5]" />
              </button>
            </div>
          ) : (
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
          )}
          <button
            type="button"
            onClick={handleClick}
            className="w-full bg-white border border-[#F0ECE3] hover:border-[#A77F3A]/40 rounded-[20px] py-3 px-4 shadow-2xs flex items-center justify-between transition-all duration-300 group/btn cursor-pointer active:scale-[0.98]"
          >
            <div className="flex-1 text-center pl-6 select-none">
              <span className="font-serif text-sm font-bold text-zinc-950 block leading-tight">Talk to Creator</span>
              <span className="text-xs text-zinc-450 font-bold block mt-0.5">on WhatsApp</span>
            </div>
            <ArrowRight className="h-5 w-5 text-zinc-950 shrink-0 transition-transform group-hover/btn:translate-x-1 stroke-[2]" />
          </button>
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

      {/* Guidelines Modal Pop-up */}
      {showGuidelines && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-md w-full mx-4 p-6 shadow-2xl space-y-4 animate-in fade-in-50 zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="font-serif text-base font-bold text-zinc-955 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-amber-500 shrink-0" />
                <span>Buying Safely on Seyon</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowGuidelines(false)}
                className="text-zinc-450 hover:text-zinc-955 text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
            
            <p className="text-xs font-bold text-zinc-700">
              Please review these quick tips before contacting the seller.
            </p>

            <div className="max-h-[320px] overflow-y-auto pr-1">
              <ul className="space-y-3.5 text-xs text-zinc-650 leading-relaxed">
                <li className="flex items-start gap-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                  <p>
                    <span className="font-bold text-zinc-900">Review the listing:</span> Check product details, photos, pricing, and seller information before placing an order.
                  </p>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                  <p>
                    <span className="font-bold text-zinc-900">Confirm everything:</span> Discuss product specifications, quantity, delivery charges, delivery timelines, and return expectations with the seller on WhatsApp.
                  </p>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                  <p>
                    <span className="font-bold text-zinc-900">Pay safely:</span> If advance payment is required, consider limiting it to <span className="font-bold text-zinc-900">10–30% of the total order value</span> and pay the remaining amount <span className="font-bold text-zinc-900">after delivery</span>, whenever both parties agree and it&apos;s practical. Prefer <span className="font-bold text-zinc-900">Cash on Delivery (COD)</span> where available.
                  </p>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                  <p>
                    <span className="font-bold text-zinc-900">Verified isn&apos;t guaranteed:</span> A <span className="font-bold text-zinc-900">Verified</span> badge confirms the seller&apos;s identity. It does <span className="font-bold text-zinc-900">not</span> guarantee product quality, delivery, or the outcome of a transaction.
                  </p>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                  <p>
                    <span className="font-bold text-zinc-900">Stay alert:</span> Seyon will <span className="font-bold text-zinc-900">never</span> ask you to transfer money on behalf of a seller. Report any suspicious activity immediately.
                  </p>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                  <p>
                    <span className="font-bold text-zinc-900">Leaving Seyon:</span> Your cart will be pre-filled into a WhatsApp message. After you continue, your conversation takes place on WhatsApp, not on Seyon.
                  </p>
                </li>
              </ul>
            </div>

            <p className="text-[11px] text-zinc-500 italic leading-relaxed pt-1 select-text">
              These are recommended safety practices to help reduce risk when buying directly from independent sellers.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full h-10 border border-zinc-200 hover:border-zinc-350 hover:bg-zinc-50 text-zinc-800 text-xs font-bold rounded-xl flex items-center justify-center transition-colors cursor-pointer select-none"
              >
                Learn More
              </a>
              <button
                type="button"
                onClick={handleRedirectToWhatsApp}
                className="w-full h-10 bg-amber-500 hover:bg-amber-400 border border-amber-600 text-black text-xs font-extrabold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer select-none"
              >
                Continue to WhatsApp
              </button>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowWhyLink(!showWhyLink)}
                className="text-[11px] text-[#A77F3A] hover:underline block mx-auto font-semibold cursor-pointer select-none"
              >
                Why am I seeing this?
              </button>
              {showWhyLink && (
                <p className="text-[11px] text-zinc-500 bg-zinc-50/80 p-2.5 rounded-xl border border-zinc-200/60 animate-in fade-in duration-200 select-text leading-relaxed">
                  Seyon connects buyers directly with independent sellers. These reminders are shown to help you shop more safely and confidently.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
