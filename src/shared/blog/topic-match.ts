import type { BlogTopic } from '@/types/blog-topic';

/**
 * Matching posts to hubs, with nothing that touches the database.
 *
 * These two live apart from `backend/lib/blog-topics` because the admin post
 * editor is a client component and needs them: importing them from the server
 * module dragged `db` — and therefore `pg` — into the browser bundle, and the
 * page died on `Module not found: Can't resolve 'dns'`. Pure functions on
 * plain rows belong on the shared side of that line.
 */

/**
 * The hubs a post belongs to, matched on tags.
 *
 * Case-insensitive, because a tag is whatever an editor typed into the post
 * form and a hub should not stop matching because somebody wrote "Jewellery"
 * where the hub says "JEWELLERY".
 */
export function topicsForTags(topics: BlogTopic[], tags: string[]): BlogTopic[] {
  const wanted = new Set(tags.map((t) => t.trim().toUpperCase()).filter(Boolean));
  if (wanted.size === 0) return [];
  return topics.filter((topic) =>
    topic.tags.some((tag) => wanted.has(tag.trim().toUpperCase()))
  );
}

/** Every tag any hub claims — the suggestions shown in the post editor. */
export function hubTags(topics: BlogTopic[]): string[] {
  return Array.from(new Set(topics.flatMap((t) => t.tags))).sort();
}
