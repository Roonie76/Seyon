'use client';

import * as React from 'react';
import Link from 'next/link';
import { SafeImage as Image } from '@/components/shared/safe-image';
import { 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  MessageCircle, 
  AlertTriangle, 
  XCircle, 
  ShieldAlert, 
  RefreshCw, 
  Check, 
  ChevronRight,
  Store,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getUserProfile } from '@/backend/actions/user-profile';
import { trackEvent } from '@/actions/analytics';
import { 
  safeParseCart, 
  getAllCartItems, 
  bumpCartVersion, 
  formatCurrency, 
  getCartMeta, 
  setCartMeta 
} from '@/frontend/lib/cart-utils';
import type { CartItem } from '@/components/store/store-cart';
import { buildCartOrderMessage } from '@/shared/lib/order-message';

// ── Types for API Response ───────────────────────────────────────────
interface ShopValidation {
  name: string;
  slug: string;
  logo: string | null;
  whatsapp: string;
  checkoutAllowed: boolean;
  checkoutBlockedReason: string | null;
}

interface ProductValidation {
  title: string;
  price: number;
  inStock: boolean;
  availableQuantity: number | null;
  checkoutAllowed: boolean;
  checkoutBlockedReason: string | null;
  variantValid: boolean;
  variantInvalidReason: string | null;
  options: string | null;
  minOrderQty: number | null;
  maxOrderQty: number | null;
}

interface CartValidateResponse {
  shops: Record<string, ShopValidation>;
  products: Record<string, ProductValidation>;
  missing: {
    products: string[];
    shops: string[];
  };
}

export function CartClient() {
  const [isMounted, setIsMounted] = React.useState(false);
  const [cartGroups, setCartGroups] = React.useState<Record<string, CartItem[]>>({});
  const [validation, setValidation] = React.useState<CartValidateResponse | null>(null);
  const [isValidating, setIsValidating] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(null);
  
  // Track accepted price increases: Record<productId_selectionsKey, acceptedBoolean>
  const [acceptedPriceIncreases, setAcceptedPriceIncreases] = React.useState<Record<string, boolean>>({});
  
  // Track active WhatsApp checkout tab-return prompt: shopId or null
  const [checkoutPromptShopId, setCheckoutPromptShopId] = React.useState<string | null>(null);

  // Shopper Profile Address for WhatsApp pre-fills
  const [profileAddress, setProfileAddress] = React.useState<{
    name?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    phone?: string | null;
  } | null>(null);

  // ── 1. Hydrate and load cart from localStorage ────────────────────
  const loadCart = React.useCallback(() => {
    const items = getAllCartItems();
    setCartGroups(items);
  }, []);

  React.useEffect(() => {
    setIsMounted(true);
    loadCart();

    // Fetch profile address
    getUserProfile('shopper')
      .then((profile) => {
        if (profile) {
          setProfileAddress({
            name: profile.name,
            addressLine1: profile.addressLine1,
            addressLine2: profile.addressLine2,
            city: profile.city,
            state: profile.state,
            postalCode: profile.postalCode,
            phone: profile.phone,
          });
        }
      })
      .catch((err) => console.error('Failed to load user profile in cart page', err));
  }, [loadCart]);

  // ── 2. Real-time validation endpoint fetcher ───────────────────────
  const validateCart = React.useCallback(async (groupsToValidate: Record<string, CartItem[]>) => {
    const allItems = Object.entries(groupsToValidate).flatMap(([shopId, items]) => 
      items.map(item => ({
        productId: item.productId,
        shopId,
        selectionsKey: item.selectionsKey,
        quantity: item.quantity
      }))
    );

    if (allItems.length === 0) {
      setValidation(null);
      return;
    }

    setIsValidating(true);
    setValidationError(null);

    try {
      const res = await fetch('/api/cart/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: allItems })
      });

      if (!res.ok) {
        throw new Error(await res.text() || 'Validation failed');
      }

      const data: CartValidateResponse = await res.json();
      setValidation(data);
      setCartMeta({ lastValidated: new Date().toISOString() });
    } catch (err) {
      console.error('Validation error', err);
      setValidationError('Unable to verify real-time price & availability. You can still order, but prices may be outdated.');
    } finally {
      setIsValidating(false);
    }
  }, []);

  // Trigger validation when cart groups change (if mounted and not empty)
  React.useEffect(() => {
    if (!isMounted) return;
    const hasItems = Object.keys(cartGroups).length > 0;
    if (hasItems && !validation && !isValidating) {
      validateCart(cartGroups);
    }
  }, [isMounted, cartGroups, validation, validateCart, isValidating]);

  // ── 3. Same-tab and Cross-tab events listener ──────────────────────
  React.useEffect(() => {
    if (!isMounted) return;

    const handleCartUpdated = () => {
      loadCart();
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key?.startsWith('seyon_cart:') || e.key === 'seyon_cart_meta') {
        loadCart();
      }
    };

    window.addEventListener('seyon-cart-updated', handleCartUpdated);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('seyon-cart-updated', handleCartUpdated);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isMounted, loadCart]);

  // Validate when tab is refocused
  React.useEffect(() => {
    if (!isMounted) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && Object.keys(cartGroups).length > 0) {
        validateCart(cartGroups);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isMounted, cartGroups, validateCart]);

  // ── 4. Cart Mutation Handlers ─────────────────────────────────────
  const updateQuantity = (shopId: string, selectionsKey: string, productId: string, change: number) => {
    const shopCart = safeParseCart(localStorage.getItem(`seyon_cart:${shopId}`) || '[]');
    const updated = shopCart.map(item => {
      if (item.productId === productId && item.selectionsKey === selectionsKey) {
        return { ...item, quantity: Math.min(Math.max(item.quantity + change, 1), 99) };
      }
      return item;
    });

    localStorage.setItem(`seyon_cart:${shopId}`, JSON.stringify(updated));
    bumpCartVersion();
    window.dispatchEvent(new CustomEvent('seyon-cart-updated', { detail: { shopId } }));
    loadCart();
  };

  const deleteItem = (shopId: string, selectionsKey: string, productId: string) => {
    const shopCart = safeParseCart(localStorage.getItem(`seyon_cart:${shopId}`) || '[]');
    const updated = shopCart.filter(item => !(item.productId === productId && item.selectionsKey === selectionsKey));
    
    if (updated.length === 0) {
      localStorage.removeItem(`seyon_cart:${shopId}`);
    } else {
      localStorage.setItem(`seyon_cart:${shopId}`, JSON.stringify(updated));
    }
    
    bumpCartVersion();
    window.dispatchEvent(new CustomEvent('seyon-cart-updated', { detail: { shopId } }));
    loadCart();
  };

  const clearStore = (shopId: string) => {
    localStorage.removeItem(`seyon_cart:${shopId}`);
    bumpCartVersion();
    window.dispatchEvent(new CustomEvent('seyon-cart-updated', { detail: { shopId } }));
    loadCart();
  };

  // Accept a price increase
  const acceptPriceIncrease = (productId: string, selectionsKey: string) => {
    const key = `${productId}_${selectionsKey}`;
    setAcceptedPriceIncreases(prev => ({ ...prev, [key]: true }));
  };

  // ── 5. WhatsApp Checkout Deep Link Handler ─────────────────────────
  const initiateCheckout = async (shopId: string) => {
    const shopItems = cartGroups[shopId];
    const shopVal = validation?.shops[shopId];
    if (!shopItems || shopItems.length === 0 || !shopVal) return;

    // Track analytics for products
    await Promise.all(
      shopItems.map(item =>
        trackEvent(shopId, 'WHATSAPP_CLICK', item.productId).catch(err =>
          console.error('Analytics click log failed', err)
        )
      )
    );

    // Build items payload mapping to checkout structure
    const formattedItems = shopItems.map(item => {
      const livePrice = validation?.products[item.productId]?.price ?? item.price;
      return {
        title: item.title,
        price: livePrice,
        quantity: item.quantity,
        selections: item.selections,
      };
    });

    const totalPrice = formattedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const messageText = buildCartOrderMessage({
      shopName: shopVal.name,
      items: formattedItems,
      totalPrice,
      address: profileAddress
    });

    // Sanitise and format wa.me URL
    let cleanNumber = shopVal.whatsapp.replace(/[^\d]/g, '');
    if (cleanNumber.length === 10) {
      cleanNumber = `91${cleanNumber}`;
    }

    const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(messageText)}`;
    
    // Open in new window/tab
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');

    // Show verification overlay prompt on return
    setCheckoutPromptShopId(shopId);
  };

  // ── 6. Rendering Logic Helpers ─────────────────────────────────────
  if (!isMounted) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <ShoppingCart className="h-10 w-10 text-muted-foreground/30 animate-pulse mx-auto mb-4" />
        <h1 className="text-xl font-bold">Loading your basket...</h1>
      </div>
    );
  }

  const shopIds = Object.keys(cartGroups);
  const isEmpty = shopIds.length === 0;

  if (isEmpty) {
    return (
      <div className="container mx-auto px-4 py-20 text-center max-w-md">
        <div className="h-16 w-16 bg-zinc-50 border border-zinc-200 rounded-2xl flex items-center justify-center mx-auto mb-6 text-muted-foreground shadow-xs">
          <ShoppingCart className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-extrabold text-foreground mb-3">Your Basket is Empty</h1>
        <p className="text-muted-foreground text-sm leading-relaxed mb-8">
          Browse items from local creators and storefronts, add them to your cart, and purchase directly via WhatsApp.
        </p>
        <Link href="/marketplace">
          <Button className="font-semibold shadow-sm w-full gap-1.5 h-11">
            Explore Marketplace <ArrowRight size={16} />
          </Button>
        </Link>
      </div>
    );
  }

  // Sorting logic (stores with validation issues first -> ready -> alphabetical)
  const sortedShopIds = [...shopIds].sort((a, b) => {
    const aVal = validation?.shops[a];
    const bVal = validation?.shops[b];

    const aHasIssue = !aVal || !aVal.checkoutAllowed || validation?.missing.shops.includes(a);
    const bHasIssue = !bVal || !bVal.checkoutAllowed || validation?.missing.shops.includes(b);

    if (aHasIssue && !bHasIssue) return -1;
    if (!aHasIssue && bHasIssue) return 1;

    const aName = aVal?.name || a;
    const bName = bVal?.name || b;
    return aName.localeCompare(bName);
  });

  return (
    <div className="container mx-auto px-4 sm:px-6 py-12 max-w-5xl">
      {/* Title & Refresh Control */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-10 pb-6 border-b border-zinc-200">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight flex items-center gap-2.5">
            <ShoppingCart className="h-7 w-7 text-amber-500" /> Shopping Basket
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Order items from multiple stores directly onto WhatsApp.
          </p>
        </div>

        {/* Validation metadata info */}
        <div className="flex items-center gap-3">
          {validation && (
            <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground">
              Last verified: {getCartMeta().lastValidated ? new Date(getCartMeta().lastValidated!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
            </span>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => validateCart(cartGroups)} 
            disabled={isValidating}
            className="gap-1.5 h-9 text-xs font-bold"
          >
            <RefreshCw size={14} className={isValidating ? 'animate-spin' : ''} />
            {isValidating ? 'Verifying...' : 'Refresh prices'}
          </Button>
        </div>
      </div>

      {validationError && (
        <div className="mb-8 p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 text-amber-900 text-xs font-semibold flex items-start gap-3 shadow-xs">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
          <div>{validationError}</div>
        </div>
      )}

      {/* Cart Groups Lists */}
      <div className="space-y-10">
        {sortedShopIds.map((shopId) => {
          const items = cartGroups[shopId];
          const shopVal = validation?.shops[shopId];
          const isDeletedShop = validation?.missing.shops.includes(shopId);

          // Check if checkout is allowed for this shop
          const isShopBlocked = shopVal && !shopVal.checkoutAllowed;
          const shopBlockReason = shopVal?.checkoutBlockedReason || '';

          let totalItemsPrice = 0;
          let hasPendingPriceIncrease = false;
          let hasInvalidItems = false;

          const itemsMarkup = items.map((item) => {
            const prodVal = validation?.products[item.productId];
            const isDeletedProd = validation?.missing.products.includes(item.productId);
            const livePrice = prodVal?.price ?? item.price;
            
            // Calc total
            totalItemsPrice += livePrice * item.quantity;

            // Price change checks
            const hasPriceChanged = prodVal && prodVal.price !== item.price;
            const isPriceIncrease = hasPriceChanged && prodVal.price > item.price;
            const isPriceDecrease = hasPriceChanged && prodVal.price < item.price;
            const priceKey = `${item.productId}_${item.selectionsKey}`;
            const isIncreaseAccepted = acceptedPriceIncreases[priceKey];

            if (isPriceIncrease && !isIncreaseAccepted) {
              hasPendingPriceIncrease = true;
            }

            // Variant check
            const isVariantInvalid = prodVal && !prodVal.variantValid;

            // Product block check
            const isProdBlocked = prodVal && !prodVal.checkoutAllowed;

            if (isDeletedProd || isVariantInvalid || isProdBlocked) {
              hasInvalidItems = true;
            }

            return (
              <div 
                key={`${item.productId}-${item.selectionsKey}`} 
                className="py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-100 last:border-0"
              >
                {/* Product Detail Thumbnail */}
                <div className="flex gap-4 items-center flex-1">
                  <div className="h-16 w-16 bg-zinc-50 border border-zinc-200 rounded-lg overflow-hidden shrink-0 relative flex items-center justify-center">
                    {item.image ? (
                      <Image src={item.image} alt={item.title} fill className="object-cover" />
                    ) : (
                      <ShoppingCart className="h-6 w-6 text-muted-foreground/20" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-sm leading-snug line-clamp-2">
                      {item.title}
                    </h3>
                    
                    {/* Selected Options */}
                    {Object.keys(item.selections).length > 0 && (
                      <p className="text-[11px] text-muted-foreground mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                        {Object.entries(item.selections).map(([k, v]) => (
                          <span key={k} className="bg-zinc-100 px-1.5 py-0.5 rounded-sm">
                            {k}: <strong className="text-zinc-700">{v}</strong>
                          </span>
                        ))}
                      </p>
                    )}

                    {/* Discrepancy Badges */}
                    {isDeletedProd && (
                      <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200/60 px-2 py-0.5 rounded-md">
                        <XCircle size={10} /> Product no longer exists
                      </span>
                    )}

                    {!isDeletedProd && isVariantInvalid && (
                      <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200/60 px-2 py-0.5 rounded-md">
                        <AlertTriangle size={10} /> {prodVal?.variantInvalidReason || 'Options configuration modified'}
                      </span>
                    )}

                    {!isDeletedProd && !isVariantInvalid && isProdBlocked && (
                      <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200/60 px-2 py-0.5 rounded-md">
                        <XCircle size={10} /> {prodVal?.checkoutBlockedReason || 'Unavailable'}
                      </span>
                    )}

                    {/* Price Decreased Notice */}
                    {isPriceDecrease && (
                      <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md">
                        <Check size={10} /> Price dropped! (saved {formatCurrency(item.price - prodVal.price)})
                      </span>
                    )}
                  </div>
                </div>

                {/* Pricing / Adjustments Options */}
                <div className="flex sm:flex-col items-end justify-between sm:justify-start w-full sm:w-auto gap-4">
                  {/* Quantity adjusts */}
                  <div className="flex items-center gap-1 bg-zinc-50 border border-zinc-200 rounded-lg p-1">
                    <button 
                      aria-label="Decrease quantity"
                      onClick={() => updateQuantity(shopId, item.selectionsKey, item.productId, -1)}
                      disabled={item.quantity <= 1}
                      className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center text-xs font-bold text-foreground">
                      {item.quantity}
                    </span>
                    <button 
                      aria-label="Increase quantity"
                      onClick={() => updateQuantity(shopId, item.selectionsKey, item.productId, 1)}
                      disabled={item.quantity >= 99}
                      className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  {/* Price info column */}
                  <div className="text-right">
                    <div className="text-sm font-black text-foreground">
                      {formatCurrency(livePrice * item.quantity)}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {item.quantity} × {formatCurrency(livePrice)}
                    </div>
                  </div>
                </div>

                {/* Price change confirmation banner for increases */}
                {isPriceIncrease && !isIncreaseAccepted && (
                  <div className="w-full mt-2 bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-semibold text-amber-900 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>
                        Price increased from <strong>{formatCurrency(item.price)}</strong> to <strong>{formatCurrency(prodVal.price)}</strong> (+{formatCurrency(prodVal.price - item.price)})
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => acceptPriceIncrease(item.productId, item.selectionsKey)}
                        className="h-8 text-xs font-bold border-amber-300 text-amber-900 bg-amber-100/50 hover:bg-amber-100"
                      >
                        Accept Price
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => deleteItem(shopId, item.selectionsKey, item.productId)}
                        className="h-8 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                )}

                {/* Actions row: Delete Button */}
                <button 
                  aria-label={`Remove ${item.title}`}
                  onClick={() => deleteItem(shopId, item.selectionsKey, item.productId)}
                  className="p-1.5 hover:bg-zinc-100 rounded-lg text-muted-foreground hover:text-rose-600 cursor-pointer self-start sm:self-center shrink-0"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          });

          // Disable checkout trigger states
          const checkoutBlocked = isShopBlocked || hasPendingPriceIncrease || hasInvalidItems || isDeletedShop || isValidating;

          return (
            <Card key={shopId} className={`glass overflow-hidden transition-all duration-300 ${checkoutBlocked ? 'border-zinc-200' : 'hover:border-amber-500/30 hover:shadow-md'}`}>
              <div className="bg-zinc-50 border-b border-zinc-200 px-5 py-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                {/* Store Header Detail */}
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 bg-white border border-zinc-200 rounded-lg flex items-center justify-center shrink-0 overflow-hidden relative shadow-2xs">
                    {shopVal?.logo ? (
                      <Image src={shopVal.logo} alt={shopVal.name} fill className="object-cover" />
                    ) : (
                      <Store size={18} className="text-muted-foreground/40" />
                    )}
                  </div>
                  <div>
                    {isDeletedShop ? (
                      <h2 className="font-extrabold text-foreground text-sm flex items-center gap-1.5">
                        Unknown Store <Badge variant="destructive" className="text-[9px]"><ShieldAlert size={8} /> Store Deleted</Badge>
                      </h2>
                    ) : (
                      <h2 className="font-extrabold text-foreground text-sm flex items-center gap-1.5">
                        {shopVal?.name || 'Loading details...'}
                        {shopVal && (
                          <Link href={`/store/${shopVal.slug}`} className="text-muted-foreground hover:text-amber-600">
                            <ChevronRight size={14} />
                          </Link>
                        )}
                      </h2>
                    )}
                    <span className="text-[10px] text-muted-foreground font-semibold">
                      {items.length} {items.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                </div>

                {/* Store operations button */}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => clearStore(shopId)}
                  className="h-8 text-xs font-semibold text-rose-600 hover:bg-rose-50/50 self-start sm:self-center"
                >
                  <Trash2 size={13} className="mr-1" /> Clear Cart
                </Button>
              </div>

              {/* Items in this Shop group */}
              <CardContent className="px-5 py-2">
                {isDeletedShop && (
                  <div className="my-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold flex items-center gap-3 shadow-2xs">
                    <XCircle className="h-4 w-4 shrink-0 text-rose-600" />
                    <div>This seller storefront has been deleted from Seyon. Please clear this section to continue.</div>
                  </div>
                )}

                {isShopBlocked && (
                  <div className="my-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold flex items-start gap-3 shadow-2xs">
                    <XCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                    <div>{shopBlockReason}</div>
                  </div>
                )}

                {/* Items row render */}
                <div className="flex flex-col">
                  {itemsMarkup}
                </div>

                {/* Summary / Order CTA Block */}
                <div className="mt-4 pt-6 border-t border-zinc-200 flex flex-col sm:flex-row justify-between sm:items-center gap-6 pb-4">
                  <div>
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Estimated Total</span>
                    <span className="text-2xl font-black text-foreground">{formatCurrency(totalItemsPrice)}</span>
                  </div>

                  {checkoutPromptShopId === shopId ? (
                    /* Checkout Return Overlay prompt */
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex flex-col gap-3 max-w-sm">
                      <p className="text-xs font-bold text-amber-900 leading-snug">
                        Did you send the message to {shopVal?.name || 'the store'} on WhatsApp?
                      </p>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Opening WhatsApp draft opens a message request but doesn't complete the order until sent.
                      </p>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => {
                            clearStore(shopId);
                            setCheckoutPromptShopId(null);
                          }}
                          className="h-8 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-black shadow-xs"
                        >
                          Clear Store Basket
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => setCheckoutPromptShopId(null)}
                          className="h-8 text-xs font-bold border-zinc-300 text-foreground bg-white"
                        >
                          Keep in Cart
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Checkout trigger button */
                    <Button 
                      disabled={checkoutBlocked}
                      onClick={() => initiateCheckout(shopId)}
                      className="font-bold gap-2 h-12 shadow-sm px-6 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <MessageCircle size={18} fill="currentColor" /> Order via WhatsApp
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Cart footer disclaimers & return option */}
      <div className="mt-12 pt-6 border-t border-zinc-200 flex flex-col sm:flex-row justify-between sm:items-center gap-4 text-center sm:text-left">
        <Link href="/marketplace">
          <Button variant="ghost" size="sm" className="gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft size={14} /> Back to marketplace
          </Button>
        </Link>
        <span className="text-[10px] sm:text-xs text-muted-foreground italic font-medium">
          Prices and availability are verified when this page loads. Items are not reserved.
        </span>
      </div>
    </div>
  );
}
