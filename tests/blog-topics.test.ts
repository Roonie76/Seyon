/**
 * Blog hubs, now that an editor creates them.
 *
 * This file used to assert things about five objects in
 * `src/shared/blog/topics.ts` — unique slugs, upper-case tags, titles inside
 * the length a search result shows. Those were fine as tests while only a
 * developer could change the file. They are useless as tests now that hubs are
 * rows an editor writes at three in the morning: a test cannot stop a save.
 *
 * So the rules moved into `BlogTopicInputSchema`, which every write goes
 * through, and what is tested here is the schema itself and the two pure
 * functions the pages use to match posts to hubs. Nothing here reads a file or
 * needs a database.
 *
 * The corpus-wide checks that used to live alongside these — every post in a
 * hub, no empty hub, exactly one featured post — are now `npm run blog:doctor`,
 * which runs against a real database and can therefore see a post somebody
 * published five minutes ago.
 */
import { describe, it, expect } from 'vitest';
import {
  BlogTopicInputSchema,
  MAX_TOPIC_SEO_TITLE,
  MAX_TOPIC_DESCRIPTION,
} from '../src/shared/blog/topic-schema';
import { topicsForTags, hubTags } from '../src/shared/blog/topic-match';
import type { BlogTopic } from '../src/types/blog-topic';

/** A hub row, with only the fields the pure functions read filled in. */
function topic(over: Partial<BlogTopic> = {}): BlogTopic {
  return {
    id: over.slug ?? 'id',
    slug: 'jewellery',
    label: 'Jewellery',
    heading: 'Jewellery worth understanding',
    seoTitle: 'Indian Jewellery: A Buyer’s Guide',
    description: 'What the words mean.',
    intro: ['One.', 'Two.'],
    tags: ['JEWELLERY', 'GOLD'],
    sortOrder: 0,
    published: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as BlogTopic;
}

const valid = {
  slug: 'buying-well',
  label: 'Buying well',
  heading: 'How to buy something you will keep',
  seoTitle: 'How to Buy Well',
  description: 'The checks worth doing with the thing in your hand.',
  intro: ['A paragraph.', 'Another.'],
  tags: ['BUYING-GUIDE', 'CARE'],
  sortOrder: 3,
  published: true,
};

describe('what a hub is allowed to be', () => {
  it('accepts a well-formed hub', () => {
    expect(BlogTopicInputSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a slug that would not make a clean URL', () => {
    // The slug becomes /blog/topic/<slug>; anything else 404s or, worse,
    // resolves to a second address for the same page.
    for (const slug of ['Jewellery', 'buying well', 'buying--well', '-lead', 'trail-', 'ünicode', '']) {
      const res = BlogTopicInputSchema.safeParse({ ...valid, slug });
      expect(res.success, `slug=${JSON.stringify(slug)}`).toBe(false);
    }
  });

  it('accepts the slug shapes the five original hubs used', () => {
    for (const slug of ['jewellery', 'textiles', 'home', 'buying-well', 'buying-for-yourself']) {
      expect(BlogTopicInputSchema.safeParse({ ...valid, slug }).success, slug).toBe(true);
    }
  });

  it('keeps the SEO title inside what a search result displays', () => {
    // The layout appends " | Seyon". Over the limit the brand is what gets cut.
    const ok = 'x'.repeat(MAX_TOPIC_SEO_TITLE);
    const over = 'x'.repeat(MAX_TOPIC_SEO_TITLE + 1);
    expect(BlogTopicInputSchema.safeParse({ ...valid, seoTitle: ok }).success).toBe(true);
    expect(BlogTopicInputSchema.safeParse({ ...valid, seoTitle: over }).success).toBe(false);
  });

  it('keeps the description inside what a search result displays', () => {
    const over = 'x'.repeat(MAX_TOPIC_DESCRIPTION + 1);
    expect(BlogTopicInputSchema.safeParse({ ...valid, description: over }).success).toBe(false);
  });

  it('refuses a hub with no copy of its own', () => {
    // A page of nothing but links is thin content, and thin hub pages are the
    // first thing a search engine drops.
    expect(BlogTopicInputSchema.safeParse({ ...valid, intro: [] }).success).toBe(false);
    expect(BlogTopicInputSchema.safeParse({ ...valid, intro: ['   '] }).success).toBe(false);
  });

  it('normalises tags to upper case and de-duplicates them', () => {
    const res = BlogTopicInputSchema.safeParse({
      ...valid,
      tags: ['jewellery', 'JEWELLERY', ' gold ', 'Gold'],
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.tags).toEqual(['JEWELLERY', 'GOLD']);
  });

  it('allows a hub with no tags, which is a hub being drafted', () => {
    // It matches nothing, which the admin list flags as empty rather than
    // refusing outright — an editor building one out over a few minutes should
    // not be blocked by the order they fill the form in.
    expect(BlogTopicInputSchema.safeParse({ ...valid, tags: [] }).success).toBe(true);
  });

  it('rejects a sort order outside the range the column holds', () => {
    expect(BlogTopicInputSchema.safeParse({ ...valid, sortOrder: -1 }).success).toBe(false);
    expect(BlogTopicInputSchema.safeParse({ ...valid, sortOrder: 1.5 }).success).toBe(false);
    expect(BlogTopicInputSchema.safeParse({ ...valid, sortOrder: 1000 }).success).toBe(false);
  });

  it('trims, so a stray space cannot pass as content', () => {
    for (const field of ['label', 'heading', 'seoTitle', 'description'] as const) {
      expect(
        BlogTopicInputSchema.safeParse({ ...valid, [field]: '   ' }).success,
        field
      ).toBe(false);
    }
  });
});

describe('matching posts to hubs', () => {
  const topics = [
    topic({ slug: 'jewellery', label: 'Jewellery', tags: ['JEWELLERY', 'GOLD'] }),
    topic({ slug: 'textiles', label: 'Textiles', tags: ['TEXTILES', 'SAREES'] }),
    topic({ slug: 'empty', label: 'Empty', tags: [] }),
  ];

  it('matches case-insensitively', () => {
    // Tags are whatever an editor typed into the post form; a hub should not
    // stop matching because someone wrote "Jewellery" where it says "JEWELLERY".
    expect(topicsForTags(topics, ['jewellery']).map((t) => t.slug)).toEqual(['jewellery']);
    expect(topicsForTags(topics, ['  Gold  ']).map((t) => t.slug)).toEqual(['jewellery']);
  });

  it('returns every hub a post belongs to, in the order given', () => {
    expect(topicsForTags(topics, ['SAREES', 'GOLD']).map((t) => t.slug)).toEqual([
      'jewellery',
      'textiles',
    ]);
  });

  it('returns nothing for a post whose tags match no hub', () => {
    expect(topicsForTags(topics, ['NOSUCHTAG'])).toEqual([]);
    expect(topicsForTags(topics, [])).toEqual([]);
    expect(topicsForTags(topics, ['', '  '])).toEqual([]);
  });

  it('never matches a hub that lists no tags', () => {
    for (const tags of [['JEWELLERY'], ['TEXTILES'], ['ANYTHING']]) {
      expect(topicsForTags(topics, tags).some((t) => t.slug === 'empty')).toBe(false);
    }
  });

  it('collects the tag suggestions the post editor offers', () => {
    expect(hubTags(topics)).toEqual(['GOLD', 'JEWELLERY', 'SAREES', 'TEXTILES']);
  });
});
