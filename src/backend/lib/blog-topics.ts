import { cache } from 'react';
import { db } from '@/lib/db';
import type { BlogTopic } from '@/types/blog-topic';

// Re-exported so server callers have one import, but defined in `shared` —
// the admin post editor is a client component and cannot pull `db` in with them.
export { topicsForTags, hubTags } from '@/shared/blog/topic-match';

/**
 * Reading the blog hubs.
 *
 * These were five objects in `src/shared/blog/topics.ts`, so renaming a hub,
 * rewording its intro, adding one for a new tag, or taking one down were all
 * code changes. A post published from the admin screen carrying a tag that no
 * hub listed belonged to nothing, and nobody found out.
 *
 * Every read is memoised per request: the blog index renders the hub grid, the
 * article page resolves the hubs a post belongs to, and the sitemap lists them
 * all - three callers that would otherwise be three identical queries.
 *
 * Hubs are ordered by `sortOrder` then `label`, so the order is something an
 * editor sets rather than something the database happens to return.
 */

/** A hard ceiling. The grid is a navigation aid, not an archive. */
export const MAX_TOPICS = 50;

/** Every published hub, in the order an editor arranged them. */
export const getBlogTopics = cache(async function getBlogTopics(): Promise<BlogTopic[]> {
  return db.blogTopic.findMany({
    where: { published: true },
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    take: MAX_TOPICS,
  });
});

/**
 * Every hub including unpublished ones, for the admin list.
 *
 * Separate from `getBlogTopics` on purpose: a public page that accidentally
 * called this would leak a hub somebody is still drafting.
 */
export const getAllBlogTopics = cache(async function getAllBlogTopics(): Promise<BlogTopic[]> {
  return db.blogTopic.findMany({
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    take: MAX_TOPICS,
  });
});

/** One published hub, or null. An unknown slug is a 404, not an empty hub. */
export const getBlogTopicBySlug = cache(async function getBlogTopicBySlug(
  slug: string
): Promise<BlogTopic | null> {
  const clean = slug.trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(clean)) return null;
  const topic = await db.blogTopic.findUnique({ where: { slug: clean } });
  return topic && topic.published ? topic : null;
});

/** One hub by id, published or not — the admin edit screen. */
export async function getBlogTopicById(id: string): Promise<BlogTopic | null> {
  return db.blogTopic.findUnique({ where: { id } });
}
