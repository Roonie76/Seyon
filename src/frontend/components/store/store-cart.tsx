'use client';

import * as React from 'react';
import { ShoppingCart, X, Plus, Minus, Trash2, MessageCircle, MapPin, ClipboardCheck, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getUserProfile } from '@/backend/actions/user-profile';
import { trackEvent } from '@/actions/analytics';

export interface CartItem {
  productId: string;
  title: string;
  price: number;
  image?: string;
  quantity: number;
  selections: Record<string, string>;
  selectionsKey: string;
}

// Helper to generate a unique key for items with option variants
export function getSelectionsKey(selections: Record<string, string>): string {
  return Object.entries(selections)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join('|') || '_';
}

// Client helper functions for local storage management
export function getLocalCart(shopId: string): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`seyon_cart:${shopId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to load cart from localStorage', e);
    return [];
  }
}

export function saveLocalCart(shopId: string, items: CartItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`seyon_cart:${shopId}`, JSON.stringify(items));
    // Dispatch custom event to notify widgets
    window.dispatchEvent(new CustomEvent('seyon-cart-updated', { detail: { shopId } }));
  } catch (e) {
    console.error('Failed to save cart to localStorage', e);
  }
}

interface StoreCartWidgetProps {
  shopId: string;
  shopName: string;
  whatsappNumber: string;
}

export function StoreCartWidget({ shopId, shopName, whatsappNumber }: StoreCartWidgetProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [items, setItems] = React.useState<CartItem[]>(() => getLocalCart(shopId));
  const [address, setAddress] = React.useState<{
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
    phone?: string | null;
    name?: string | null;
  } | null>(null);

  // Sync state with localStorage on mount and updates
  React.useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.shopId === shopId) {
        setItems(getLocalCart(shopId));
      }
    };

    window.addEventListener('seyon-cart-updated', handleUpdate);

    // Fetch user address if logged in
    getUserProfile('shopper')
      .then((profile) => {
        if (profile) {
          setAddress({
            addressLine1: profile.addressLine1,
            addressLine2: profile.addressLine2,
            city: profile.city,
            state: profile.state,
            postalCode: profile.postalCode,
            country: profile.country,
            phone: profile.phone,
            name: profile.name,
          });
        }
      })
      .catch((err) => console.error('Failed to load user profile in cart', err));

    return () => {
      window.removeEventListener('seyon-cart-updated', handleUpdate);
    };
  }, [shopId]);

  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const updateQuantity = (selectionsKey: string, change: number) => {
    const updated = items
      .map((item) => {
        if (item.selectionsKey === selectionsKey) {
          const newQty = item.quantity + change;
          return { ...item, quantity: Math.max(1, newQty) };
        }
        return item;
      })
      .filter((item) => item.quantity > 0);
    saveLocalCart(shopId, updated);
  };

  const removeItem = (selectionsKey: string) => {
    const updated = items.filter((item) => item.selectionsKey !== selectionsKey);
    saveLocalCart(shopId, updated);
  };

  const handleCheckout = async () => {
    if (items.length === 0) return;

    // Track analytics click for each product in the cart
    await Promise.all(
      items.map((item) =>
        trackEvent(shopId, 'WHATSAPP_CLICK', item.productId).catch((err) =>
          console.error('Analytics track error', err)
        )
      )
    );

    // Build the order message
    let message = `Hi! I would like to place an order from your storefront "${shopName}" for the following items:\n\n`;

    items.forEach((item, index) => {
      message += `${index + 1}. *${item.title}*\n`;
      if (Object.keys(item.selections).length > 0) {
        const specs = Object.entries(item.selections)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ');
        message += `   _Options: ${specs}_\n`;
      }
      message += `   Qty: ${item.quantity} × ₹${item.price.toFixed(2)} = *₹${(item.quantity * item.price).toFixed(2)}*\n\n`;
    });

    message += `*Total Order Value:* ₹${totalPrice.toFixed(2)}\n`;

    // Append shipping address if saved
    const hasAddress = address && (address.addressLine1 || address.city || address.postalCode);
    if (hasAddress) {
      message += `\n*Delivery Details:*\n`;
      message += `Name: ${address.name || 'N/A'}\n`;
      message += `Address: ${[address.addressLine1, address.addressLine2].filter(Boolean).join(', ')}\n`;
      message += `City/State: ${[address.city, address.state].filter(Boolean).join(', ')} - ${address.postalCode || ''}\n`;
      if (address.phone) {
        message += `Contact: ${address.phone}\n`;
      }
    } else {
      message += `\n(I will provide my delivery address during our chat.)\n`;
    }

    // Format WhatsApp Link
    let cleanNumber = whatsappNumber.replace(/[^\d]/g, '');
    if (cleanNumber.length === 10) {
      cleanNumber = `91${cleanNumber}`;
    }

    const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  if (totalCount === 0) return null;

  return (
    <>
      {/* Floating Cart Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-5 py-4 bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-white rounded-full shadow-2xl hover:scale-105 transition-all duration-300 select-none animate-bounce cursor-pointer font-bold border border-amber-500/20"
      >
        <ShoppingCart className="h-5 w-5 animate-pulse" />
        <span className="text-xs bg-white text-amber-700 h-5 w-5 flex items-center justify-center rounded-full font-black">
          {totalCount}
        </span>
        <span className="text-xs font-black tracking-wider uppercase hidden sm:inline">View Cart</span>
      </button>

      {/* Slide-over Drawer Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end">
          {/* Backdrop Click Dismiss */}
          <button
            type="button"
            className="absolute inset-0 bg-transparent border-none w-full h-full cursor-default focus:outline-none"
            onClick={() => setIsOpen(false)}
            aria-label="Close cart drawer"
          />

          <div className="relative w-full max-w-md bg-white dark:bg-zinc-950 h-full flex flex-col shadow-2xl animate-slide-in select-none">
            {/* Header */}
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/40">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-amber-600" />
                <h3 className="font-extrabold text-lg text-zinc-900 dark:text-white">
                  Store Cart
                </h3>
                <span className="text-xs text-zinc-500 font-bold block bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                  {shopName}
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors cursor-pointer text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-grow overflow-y-auto p-5 space-y-4">
              {items.map((item) => (
                <div
                  key={item.selectionsKey}
                  className="flex gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-900 items-start justify-between"
                >
                  <div className="flex gap-3 flex-grow min-w-0">
                    <div className="relative h-16 w-16 bg-zinc-50 rounded-lg overflow-hidden shrink-0 border border-zinc-100 dark:border-zinc-900 flex items-center justify-center">
                      {item.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.image}
                          alt={item.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="text-[10px] text-zinc-400 font-bold uppercase">No Image</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-zinc-900 dark:text-white truncate">
                        {item.title}
                      </h4>
                      {Object.keys(item.selections).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {Object.entries(item.selections).map(([k, v]) => (
                            <span
                              key={k}
                              className="text-[9px] bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 px-1.5 py-0.5 rounded-sm font-semibold"
                            >
                              {k}: {v}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="text-xs font-extrabold text-zinc-950 dark:text-zinc-100 mt-2">
                        ₹{item.price.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Quantity Actions */}
                  <div className="flex flex-col items-end justify-between h-full gap-2 shrink-0">
                    <button
                      onClick={() => removeItem(item.selectionsKey)}
                      className="p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-all cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <div className="flex items-center gap-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 p-1">
                      <button
                        onClick={() => updateQuantity(item.selectionsKey, -1)}
                        className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-md transition-colors cursor-pointer text-zinc-600 dark:text-zinc-400"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-xs font-black text-zinc-900 dark:text-white w-4 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.selectionsKey, 1)}
                        className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-md transition-colors cursor-pointer text-zinc-600 dark:text-zinc-400"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Address Lookup Status Panel */}
            {address && (address.addressLine1 || address.city) ? (
              <div className="mx-5 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex gap-2.5 items-start text-xs text-emerald-800 dark:text-emerald-400 shrink-0">
                <MapPin className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="font-extrabold flex items-center gap-1">
                    Saved Shipping Details <ClipboardCheck className="h-3.5 w-3.5 text-emerald-500" />
                  </div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                    {[address.addressLine1, address.city, address.postalCode].filter(Boolean).join(', ')}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mx-5 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 flex gap-2.5 items-start text-xs text-amber-800 dark:text-amber-400 shrink-0">
                <MapPin className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <div className="font-bold">No saved shipping details</div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Add address in Shopper Settings to auto-append it to WhatsApp messages.
                  </div>
                </div>
              </div>
            )}

            {/* Checkout Footer */}
            <div className="p-5 border-t border-zinc-200 dark:border-zinc-800 space-y-4 bg-zinc-50 dark:bg-zinc-900/20">
              <div className="flex items-center justify-between text-sm font-bold text-zinc-500">
                <span>Subtotal ({totalCount} items)</span>
                <span className="text-lg font-black text-zinc-900 dark:text-white">
                  ₹{totalPrice.toFixed(2)}
                </span>
              </div>

              <button
                type="button"
                onClick={handleCheckout}
                className="w-full bg-white border border-[#F0ECE3] hover:border-[#A77F3A]/40 rounded-[20px] py-3.5 px-5 shadow-2xs flex items-center justify-between transition-all duration-300 group/btn cursor-pointer active:scale-[0.98]"
              >
                <div className="flex-1 text-center pl-6 select-none">
                  <span className="font-serif text-sm font-bold text-zinc-950 block leading-tight">Talk to Creator</span>
                  <span className="text-xs text-zinc-550 font-bold block mt-0.5">on WhatsApp to Buy</span>
                </div>
                <ArrowRight className="h-5 w-5 text-zinc-950 shrink-0 transition-transform group-hover/btn:translate-x-1 stroke-[2]" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
