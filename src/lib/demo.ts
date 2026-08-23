/**
 * Seyon Social Commerce Demo Data Service
 * Centralises development-only social proof and trust metrics.
 *
 * CRITICAL GUARDRAIL:
 * All placeholders are only enabled when process.env.NODE_ENV === 'development'.
 * In production every field is either real or NULL — never invented.
 *
 * The production branch used to still default to 4.8 stars, "Mumbai" and a
 * blanket "Verified Creator" tag, so a brand-new shop with no reviews, no city
 * and isVerified = false was presented to buyers as an established, verified,
 * 4.8-rated seller. Callers must now handle null and render nothing.
 */

const isDevelopment = process.env.NODE_ENV === 'development';

export interface CreatorPresentation {
  /** Real average rating, or null when the shop has no reviews yet. */
  rating: number | null;
  /** Real seller city, or null when they have not provided one. */
  location: string | null;
  /** Only set when something true can be said about the seller. */
  trustTag: string | null;
  orderCountLabel?: string;
}

const DEMO_CREATORS_MAP: Record<string, Partial<CreatorPresentation>> = {
  'aroma-palace': {
    rating: 4.9,
    location: 'Mumbai',
    trustTag: '2.1K WhatsApp inquiries',
    orderCountLabel: '2,100+ orders'
  },
  'crafted-dreams': {
    rating: 4.8,
    location: 'Kerala',
    trustTag: '820 happy customers',
    orderCountLabel: '820+ orders'
  },
  'silver-stories': {
    rating: 5.0,
    location: 'Delhi',
    trustTag: 'Featured Creator',
    orderCountLabel: '1,500+ orders'
  },
  'clay-house': {
    rating: 4.7,
    location: 'Jaipur',
    trustTag: 'Ships across India',
    orderCountLabel: '600+ orders'
  },
  'print-paint': {
    rating: 4.9,
    location: 'Bangalore',
    trustTag: 'Verified Seller',
    orderCountLabel: '950+ orders'
  }
};

const DEMO_BADGES = [
  'Creator Pick',
  'Trending',
  'Recently Added',
  'Handmade',
  'Made in India',
  'Limited Batch',
  'Customer Favorite',
  'Fast Response',
  'Verified Creator',
  'Popular Gift',
  'Eco Friendly',
  'Ships in 48h'
];

const DEMO_CITIES = ['Mumbai', 'Kerala', 'Delhi', 'Jaipur', 'Bangalore', 'Pune', 'Hyderabad', 'Chennai'];
const DEMO_TAGS = [
  'Verified Seller',
  'Featured Creator',
  'Ships across India',
  'Fast Response',
  'Customer Favorite',
  'Top Rated Seller'
];

/**
 * Returns deterministic hash from string id
 */
function getDeterministicHash(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

/**
 * Enriches a shop with natural, high-fidelity presentation metrics in development.
 */
export function getCreatorPresentation(shop: {
  id: string;
  name: string;
  slug: string;
  city?: string | null;
  averageRating?: number;
  reviewCount?: number;
  isVerified?: boolean;
}): CreatorPresentation {
  const realRating =
    shop.averageRating && shop.averageRating > 0 && (shop.reviewCount ?? 0) > 0
      ? shop.averageRating
      : null;
  const realLocation = shop.city || null;

  if (!isDevelopment) {
    // Production: nothing invented. A shop with no reviews shows no rating,
    // a shop with no city shows no location, and only a genuinely verified
    // seller carries a verification tag.
    return {
      rating: realRating,
      location: realLocation,
      trustTag: shop.isVerified ? 'Verified Creator' : null,
    };
  }

  const baseRating = realRating ?? 4.8;
  const baseLocation = realLocation ?? 'Mumbai';

  // Check if we have an explicit mapping by slug
  const slugLower = shop.slug.toLowerCase();
  const explicit = DEMO_CREATORS_MAP[slugLower] || DEMO_CREATORS_MAP[shop.slug];
  if (explicit) {
    return {
      rating: explicit.rating ?? baseRating,
      location: explicit.location ?? baseLocation,
      trustTag: explicit.trustTag ?? 'Verified Seller',
      orderCountLabel: explicit.orderCountLabel
    };
  }

  // Fallback to deterministic generation based on shop ID
  const hash = getDeterministicHash(shop.id);
  const rating = parseFloat((4.5 + (hash % 6) * 0.1).toFixed(1)); // 4.5 to 5.0
  const location = shop.city || DEMO_CITIES[hash % DEMO_CITIES.length];
  
  // Custom trust tags and order count simulation
  const tagIndex = hash % DEMO_TAGS.length;
  let trustTag = DEMO_TAGS[tagIndex];
  let orderCountLabel: string | undefined;

  if (hash % 3 === 0) {
    const orders = (hash % 1500) + 120;
    trustTag = `${orders} WhatsApp inquiries`;
    orderCountLabel = `${orders}+ orders`;
  } else if (hash % 3 === 1) {
    const customers = (hash % 800) + 80;
    trustTag = `${customers} happy customers`;
    orderCountLabel = `${customers}+ happy customers`;
  }

  return {
    rating,
    location,
    trustTag,
    orderCountLabel
  };
}

/**
 * Assigns stable, organic badges to products in development based on ID.
 */
export function getProductBadges(productId: string): string[] {
  if (!isDevelopment) return [];

  const hash = getDeterministicHash(productId);
  const primaryBadge = DEMO_BADGES[hash % DEMO_BADGES.length];

  // 30% chance of a second badge
  if (hash % 10 < 3) {
    const secondaryBadge = DEMO_BADGES[(hash + 1) % DEMO_BADGES.length];
    return [primaryBadge, secondaryBadge];
  }

  return [primaryBadge];
}

/**
 * Returns social interaction stats for the Hero smartphone reel.
 */
export function getHeroReelStats(): { likes: string; comments: string; shares: string } {
  if (!isDevelopment) {
    return { likes: '0', comments: '0', shares: '0' };
  }
  return {
    likes: '12.4K',
    comments: '483',
    shares: '124'
  };
}

const DEMO_CATEGORY_COUNTS: Record<string, number> = {
  'fashion': 9842,
  'electronics': 6128,
  'beauty': 5463,
  'home & living': 7329,
  'clay crafts': 1863,
  'diy crafts': 2345,
  'art & collectibles': 3215,
  'food & beverages': 4987
};

/**
 * Returns premium mockup counts for categories in development, or actual counts in production.
 */
export function getCategoryProductCount(categoryName: string, realCount: number): number {
  if (!isDevelopment) {
    return realCount;
  }
  const key = categoryName.toLowerCase().trim();
  return DEMO_CATEGORY_COUNTS[key] ?? (realCount > 0 ? realCount : 150 + (getDeterministicHash(key) % 850));
}

