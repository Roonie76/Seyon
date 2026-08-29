'use client';

import type { CartItem } from '@/components/store/store-cart';

// ── localStorage sanitiser ──────────────────────────────────────────
// Never trust raw data from localStorage — DevTools edits, corruption,
// or future schema migrations can all produce garbage.
export function safeParseCart(raw: string): CartItem[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item: unknown): item is CartItem =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as CartItem).productId === 'string' &&
          (item as CartItem).productId.length > 0 &&
          typeof (item as CartItem).title === 'string' &&
          (item as CartItem).title.length > 0 &&
          typeof (item as CartItem).price === 'number' &&
          isFinite((item as CartItem).price) &&
          (item as CartItem).price >= 0 &&
          typeof (item as CartItem).quantity === 'number' &&
          Number.isInteger((item as CartItem).quantity) &&
          (item as CartItem).quantity > 0 &&
          typeof (item as CartItem).selectionsKey === 'string' &&
          typeof (item as CartItem).selections === 'object' &&
          (item as CartItem).selections !== null
      )
      .map((item) => ({
        ...item,
        quantity: Math.min(Math.max(item.quantity, 1), 99),
        price: Math.max(item.price, 0),
      }));
  } catch {
    return [];
  }
}

// ── Scan all seyon_cart:* keys ────────────────────────────────────────
export function getAllCartShopIds(): string[] {
  if (typeof window === 'undefined') return [];
  /**
   * Wrapped, because reading `localStorage` is not merely empty when a
   * browser blocks site data - the property access itself throws a
   * SecurityError. This function is reached from the navbar's cart badge on
   * every page, and the throw took the whole navbar down: reproduced with
   * storage denied, the site rendered "Something went wrong" with a
   * SecurityError in <NavbarClient> and no navigation at all.
   */
  try {
    const ids: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('seyon_cart:')) {
        ids.push(key.replace('seyon_cart:', ''));
      }
    }
    return ids;
  } catch {
    return [];
  }
}

// ── Get all cart items grouped by shopId ──────────────────────────────
export function getAllCartItems(): Record<string, CartItem[]> {
  const result: Record<string, CartItem[]> = {};
  try {
    for (const shopId of getAllCartShopIds()) {
      const raw = localStorage.getItem(`seyon_cart:${shopId}`);
      if (raw) {
        const items = safeParseCart(raw);
        if (items.length > 0) {
          result[shopId] = items;
        } else {
          // Clean up corrupt/empty keys
          localStorage.removeItem(`seyon_cart:${shopId}`);
        }
      }
    }
  } catch {
    // Blocked site data. An empty cart is wrong but survivable; a thrown
    // SecurityError during render is not.
  }
  return result;
}

// ── Total quantity across all stores ─────────────────────────────────
export function getTotalCartCount(): number {
  const allItems = getAllCartItems();
  return Object.values(allItems).reduce(
    (total, items) => total + items.reduce((sum, item) => sum + item.quantity, 0),
    0
  );
}

// ── Cart metadata ────────────────────────────────────────────────────
export interface CartMeta {
  lastValidated: string | null;
  cartVersion: number;
  currency: 'INR';
}

const CART_META_KEY = 'seyon_cart_meta';

export function getCartMeta(): CartMeta {
  if (typeof window === 'undefined') {
    return { lastValidated: null, cartVersion: 0, currency: 'INR' };
  }
  try {
    const raw = localStorage.getItem(CART_META_KEY);
    if (!raw) return { lastValidated: null, cartVersion: 0, currency: 'INR' };
    const parsed = JSON.parse(raw);
    return {
      lastValidated:
        typeof parsed.lastValidated === 'string' ? parsed.lastValidated : null,
      cartVersion:
        typeof parsed.cartVersion === 'number' ? parsed.cartVersion : 0,
      currency: 'INR',
    };
  } catch {
    return { lastValidated: null, cartVersion: 0, currency: 'INR' };
  }
}

export function setCartMeta(updates: Partial<CartMeta>): void {
  if (typeof window === 'undefined') return;
  const current = getCartMeta();
  const merged: CartMeta = { ...current, ...updates };
  localStorage.setItem(CART_META_KEY, JSON.stringify(merged));
}

export function bumpCartVersion(): void {
  const meta = getCartMeta();
  setCartMeta({ cartVersion: meta.cartVersion + 1 });
}

// ── Currency formatter ───────────────────────────────────────────────
const INR_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatCurrency(amount: number): string {
  return INR_FORMATTER.format(amount);
}

// ── Sanitise text for WhatsApp message ───────────────────────────────
// Strip control chars and zero-width characters, truncate to maxLen.
export function sanitiseMessageText(text: string, maxLen = 80): string {
  return text
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\uFEFF]/g, '')
    .trim()
    .slice(0, maxLen);
}
