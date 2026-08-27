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
    slug: 'jewellery',
    label: 'Jewellery',
    heading: 'Jewellery worth understanding before you buy it',
    seoTitle: 'Indian Jewellery: A Buyer\u2019s Guide',
    description:
      'What kundan, polki, jadau and meenakari actually mean, how to read a hallmark, and how to tell craft from finish when you are holding the piece.',
    intro: [
      'Almost every word used to sell Indian jewellery describes a technique, and almost none of them are explained at the counter. Kundan and polki are not the same thing. Jadau is a method, not a stone. Meenakari is on the back of the piece, which is where a good one hides its best work.',
      'These are guides to the vocabulary and to the checks worth doing with the piece in your hand — what the hallmark is legally required to tell you, what it is not, and which differences change the price by a factor of ten.',
    ],
    tags: ['JEWELLERY', 'SILVER', 'GOLD', 'GEMSTONES'],
  },
  {
    slug: 'textiles',
    label: 'Textiles',
    heading: 'Textiles, and how to read one before you own it',
    seoTitle: 'Indian Textiles: How to Read Cloth Before Buying',
    description:
      'Handloom against powerloom, block print against screen print, and the weaves worth knowing by name — each with the checks you can do standing in a shop.',
    intro: [
      'Cloth is the easiest thing in India to be sold a story about, because the difference between the real thing and the convincing copy is often invisible in a photograph and obvious in the hand. A block print has a heartbeat — tiny registration shifts where the wooden block landed a hair off. A screen print does not.',
      'These pieces are about learning what to look for: the selvedge, the reverse, the repeat, the weight. None of it requires expertise. All of it is the difference between paying for handwork and paying for the word.',
    ],
    tags: ['TEXTILES', 'SAREES', 'HANDLOOM', 'BLOCK-PRINT'],
  },
  {
    slug: 'home',
    label: 'For the home',
    heading: 'Objects for the home that are built to be used',
    seoTitle: 'Handmade Homeware: Metal, Clay and Wood',
    description:
      'Brass against bronze against copper, terracotta against stoneware against porcelain, and lacquered wood — what each is actually good for, and how to keep it.',
    intro: [
      'The pleasure of a handmade object at home is that it is meant to be used, and the anxiety is that you will ruin it. Most of that anxiety comes from not knowing what the material can take: which metal minds the lemon, which clay minds the flame, which finish minds the dishwasher.',
      'These guides cover what each material is for, what will happen to it over years, and the care that is genuinely necessary as opposed to the care everyone repeats.',
    ],
    tags: ['HOME', 'CERAMICS', 'METALWARE', 'DECOR'],
  },
  {
    slug: 'buying-well',
    label: 'Buying well',
    heading: 'Buying well from people who make things',
    seoTitle: 'Buying Handmade: What to Know First',
    description:
      'What “handmade” is allowed to mean, things independent Indian makers sell that most people never discover, and how to give a gift that lands.',
    intro: [
      'Buying from someone who made the thing is a different transaction from buying from a shelf. The variation is the point rather than the defect, the person answering you is the person who made it, and the questions worth asking are not the ones you would ask a shop.',
      'These pieces are about that difference — what the words on a listing are and are not allowed to claim, what exists out there that you would never think to search for, and how to buy for someone else without guessing.',
    ],
    tags: ['BUYING-GUIDE', 'GIFTING', 'CARE', 'CRAFT'],
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
