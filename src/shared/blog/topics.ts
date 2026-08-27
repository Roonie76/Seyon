/**
 * Topic hubs.
 *
 * Tags used to exist only as `?tag=X` on /blog. That is a filter, not a page:
 * search engines treat a query parameter as a variant of /blog rather than a
 * destination of its own, so the filtered views were rarely indexed and never
 * ranked. A blog meant to bring people in needs a small number of real URLs
 * that each cover one subject well and link down into the articles beneath.
 *
 * The list is deliberately closed. Deriving hubs from whatever tags happen to
 * exist in the database would mint a new indexable URL every time an author
 * typed a new tag, which is how a blog ends up with two hundred thin pages
 * competing with each other. Adding a hub is a code change, on purpose.
 *
 * `tags` is a match list, not an assignment: a post belongs to a hub if it
 * carries any of them. Posts can and should appear under more than one hub.
 */
export interface BlogTopic {
  /** URL segment: /blog/topic/<slug> */
  slug: string;
  /** Short label used on pills and in navigation. */
  label: string;
  /** <h1> on the hub page. */
  heading: string;
  /**
   * <title>. The root layout appends " | Seyon", so this is held to 52
   * characters and the test enforces it: a title that overflows what a search
   * result displays is truncated mid-word, and the brand is what gets cut.
   */
  seoTitle: string;
  /** Meta description and the hub's own summary line. */
  description: string;
  /**
   * Introductory copy for the hub, rendered above the article list. Hubs with
   * nothing but a list of links are thin pages; this is the part that gives
   * one a reason to exist.
   */
  intro: string[];
  /** Post tags that place a post under this hub. Compared case-insensitively. */
  tags: string[];
}

export const BLOG_TOPICS: BlogTopic[] = [
  {
    slug: 'selling-on-social',
    label: 'Selling on social',
    heading: 'Selling on Instagram and WhatsApp',
    seoTitle: 'Selling on Instagram & WhatsApp in India',
    description:
      'Practical guides to selling on Instagram and WhatsApp in India: setting up the account, the catalogue, prices, captions, and where each platform stops being enough.',
    intro: [
      'Almost every independent seller in India starts on Instagram or WhatsApp, and for good reason. Both are free, both are where buyers already are, and a reel can put your work in front of people no shopfront ever would.',
      'What neither was built for is the part after the interest: the stranger who wants to know the price without asking, the buyer who is trying to work out whether you are a real business, the order that has to be found again three weeks later. These pieces cover getting the most out of both platforms, and knowing where each one stops.',
    ],
    tags: ['SOCIAL-SELLING', 'INSTAGRAM', 'WHATSAPP', 'STOREFRONT', 'STRATEGY'],
  },
  {
    slug: 'getting-found',
    label: 'Getting found',
    heading: 'Getting found and finding your first customers',
    seoTitle: 'Getting Found Online as a Small Seller',
    description:
      'How small sellers get found and win their first customers: product photography, descriptions that answer real questions, and where the first ten orders actually come from.',
    intro: [
      'Reach is the problem every new seller thinks they have, and the listing is the problem they usually have instead. A buyer who arrives and cannot tell the size, the material, or the price does not message you — they leave, and nothing in your numbers records it.',
      'These guides cover the work that makes someone findable and then makes the visit count: photographs taken on a phone, descriptions written for someone who has not held the item, and an honest account of where the first ten customers come from.',
    ],
    tags: ['DISCOVERY', 'PHOTOGRAPHY', 'LISTINGS', 'SEO'],
  },
  {
    slug: 'buyer-trust',
    label: 'Buyer trust',
    heading: 'Earning trust from buyers who have never heard of you',
    seoTitle: 'Buyer Trust for Small Online Sellers',
    description:
      'What buyers check before they send money to an unfamiliar seller, and how a new shop makes the risk visibly small: proof, specifics, reviews and being findable.',
    intro: [
      'A first-time buyer is not evaluating your product. They are evaluating the risk that you are not real — and in a market where anyone can post photographs they did not take, that is a rational thing to be careful about.',
      'These pieces are about what gets checked, in what order, and what a shop with no reviews yet can do about it. Most of it is not marketing. It is being specific about facts that other sellers leave vague.',
    ],
    tags: ['TRUST', 'BUYERS', 'REVIEWS'],
  },
  {
    slug: 'running-your-shop',
    label: 'Running your shop',
    heading: 'Running a small shop properly',
    seoTitle: 'Pricing, Shipping, Returns & GST for Small Shops',
    description:
      'The unglamorous half of selling: pricing that survives a slow month, shipping decisions made before the first order, a returns policy written in advance, and where GST fits.',
    intro: [
      'The parts of a small business that decide whether it lasts are rarely the parts anyone enjoys. Pricing worked out rather than guessed. A shipping rate that is not quietly losing money on every far-zone order. A returns policy written before the argument that needs it.',
      'These guides cover that half of the work, in the order it usually becomes urgent. Where a piece touches tax or law, it says what the rule is, names the section, and tells you to check it with someone qualified rather than pretending an article can decide it for you.',
    ],
    tags: ['OPERATIONS', 'PRICING', 'SHIPPING', 'RETURNS', 'TAX', 'ORDERS'],
  },
];

/** Hub lookup by URL segment. */
export function topicBySlug(slug: string): BlogTopic | undefined {
  const key = slug.toLowerCase();
  return BLOG_TOPICS.find((t) => t.slug === key);
}

/**
 * The hubs a post belongs to, in the order the hubs are declared so that
 * ordering is stable across pages rather than following the post's own tags.
 */
export function topicsForPost(tags: string[]): BlogTopic[] {
  const upper = new Set(tags.map((t) => t.toUpperCase()));
  return BLOG_TOPICS.filter((topic) => topic.tags.some((t) => upper.has(t)));
}

/** Every tag that maps to a hub, for the Prisma `hasSome` filter. */
export function tagsForTopic(topic: BlogTopic): string[] {
  return topic.tags;
}
