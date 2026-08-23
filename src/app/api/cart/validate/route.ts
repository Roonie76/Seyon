import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { parseOptions } from '@/shared/lib/order-message';
import { rateLimit, RATE_LIMITS } from '@/backend/lib/rate-limit';
import { logger } from '@/backend/lib/logger';

// ── Request schema ───────────────────────────────────────────────────
const CartValidateItemSchema = z.object({
  productId: z.string().min(1).max(100),
  shopId: z.string().min(1).max(100),
  selectionsKey: z.string().max(500).default('_'),
  quantity: z.number().int().min(1).max(99).default(1),
});

const CartValidateSchema = z.object({
  items: z.array(CartValidateItemSchema).min(1).max(100),
});

// ── Response types ───────────────────────────────────────────────────
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

// ── Variant validation helper ────────────────────────────────────────
function validateVariant(
  productOptions: string | null,
  selectionsKey: string
): { valid: boolean; reason: string | null } {
  // No options and no selections → valid
  if (!productOptions && selectionsKey === '_') {
    return { valid: true, reason: null };
  }
  // Had selections but product no longer has options
  if (!productOptions && selectionsKey !== '_') {
    return { valid: false, reason: 'Product no longer has options' };
  }
  // Product has options but customer didn't select any (shouldn't happen, but defensive)
  if (productOptions && selectionsKey === '_') {
    return { valid: true, reason: null };
  }

  const groups = parseOptions(productOptions!);
  const pairs = selectionsKey
    .split('|')
    .map((p) => {
      const colonIdx = p.indexOf(':');
      if (colonIdx < 0) return { label: '_', value: p };
      return { label: p.slice(0, colonIdx), value: p.slice(colonIdx + 1) };
    })
    .filter((p) => p.value.length > 0);

  for (const pair of pairs) {
    const group = groups.find(
      (g) => (g.label?.toLowerCase() || '_') === pair.label.toLowerCase()
    );
    if (!group) {
      return { valid: false, reason: `Option "${pair.label}" no longer exists` };
    }
    const match = group.values.some(
      (v) => v.toLowerCase() === pair.value.toLowerCase()
    );
    if (!match) {
      return {
        valid: false,
        reason: `"${pair.value}" is no longer available for "${pair.label}"`,
      };
    }
  }
  return { valid: true, reason: null };
}

// ── Route handler ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    // Rate-limit by IP (anonymous endpoint — no auth required)
    const ip =
      req.headers.get('x-real-ip') ||
      req.headers.get('x-forwarded-for')?.split(',').pop()?.trim() ||
      'unknown';
    const rl = await rateLimit(
      `cart-validate:${ip}`,
      RATE_LIMITS.CART_VALIDATE.limit,
      RATE_LIMITS.CART_VALIDATE.windowMs
    );
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many validation requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      );
    }

    // Parse and validate body
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const parsed = CartValidateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request format', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { items } = parsed.data;

    // Collect unique IDs for batch queries
    const productIds = [...new Set(items.map((i) => i.productId))];
    const shopIds = [...new Set(items.map((i) => i.shopId))];

    // Batch queries — two total DB round-trips
    const [products, shops] = await Promise.all([
      db.product.findMany({
        where: { id: { in: productIds }, status: 'ACTIVE' },
        select: {
          id: true,
          title: true,
          price: true,
          inStock: true,
          status: true,
          options: true,
          shopId: true,
        },
      }),
      db.shop.findMany({
        where: { id: { in: shopIds } },
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          whatsapp: true,
          isPaused: true,
          isSuspended: true,
        },
      }),
    ]);

    // Index results by ID for O(1) lookup
    const productMap = new Map(products.map((p) => [p.id, p]));
    const shopMap = new Map(shops.map((s) => [s.id, s]));

    // Build response
    const response: CartValidateResponse = {
      shops: {},
      products: {},
      missing: {
        products: [],
        shops: [],
      },
    };

    // Process shops
    for (const shopId of shopIds) {
      const shop = shopMap.get(shopId);
      if (!shop) {
        response.missing.shops.push(shopId);
        continue;
      }

      let checkoutAllowed = true;
      let checkoutBlockedReason: string | null = null;

      if (shop.isSuspended) {
        checkoutAllowed = false;
        checkoutBlockedReason = 'This seller has been suspended for policy violations.';
      } else if (shop.isPaused) {
        checkoutAllowed = false;
        checkoutBlockedReason = 'This seller is currently away. Orders are paused.';
      } else if (!shop.whatsapp || shop.whatsapp.length < 8) {
        checkoutAllowed = false;
        checkoutBlockedReason = 'No WhatsApp number configured for this store.';
      }

      response.shops[shopId] = {
        name: shop.name,
        slug: shop.slug,
        logo: shop.logo,
        // The number is only handed out when an order can actually be placed.
        // It is public on the storefront either way, but a suspended or paused
        // seller has no reason to be reachable through this endpoint.
        whatsapp: checkoutAllowed ? shop.whatsapp : '',
        checkoutAllowed,
        checkoutBlockedReason,
      };
    }

    // Process products — per-item to handle variant validation
    for (const item of items) {
      // Skip if already processed (same productId can appear with different variants)
      if (response.products[item.productId]) continue;

      const product = productMap.get(item.productId);
      // A product the buyer cannot see is reported as missing rather than
      // described. This endpoint is unauthenticated, so returning the title
      // and price of a DRAFT or ARCHIVED listing to anyone holding an id
      // leaked catalogue the seller has not published.
      if (!product || product.status !== 'ACTIVE') {
        response.missing.products.push(item.productId);
        continue;
      }

      // The cart is client-side state and the pairing is client-supplied, so
      // a tampered or stale cart could attach one seller's product to another
      // seller's WhatsApp number. Refuse the pairing rather than trust it.
      if (product.shopId !== item.shopId) {
        response.missing.products.push(item.productId);
        continue;
      }

      let checkoutAllowed = true;
      let checkoutBlockedReason: string | null = null;

      if (!product.inStock) {
        checkoutAllowed = false;
        checkoutBlockedReason = 'This product is currently sold out.';
      }

      // Variant validation
      const variant = validateVariant(product.options, item.selectionsKey);

      response.products[item.productId] = {
        title: product.title,
        price: product.price,
        inStock: product.inStock,
        availableQuantity: null, // No numeric inventory in schema yet
        checkoutAllowed,
        checkoutBlockedReason,
        variantValid: variant.valid,
        variantInvalidReason: variant.reason,
        options: product.options,
        minOrderQty: null, // Not in schema yet
        maxOrderQty: null, // Not in schema yet
      };
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    logger.error('Cart validation error', error);
    return NextResponse.json(
      { error: 'An error occurred while validating your cart.' },
      { status: 500 }
    );
  }
}
