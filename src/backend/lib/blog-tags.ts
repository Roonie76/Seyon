import { cache } from 'react';
import { db } from '@/lib/db';

/**
 * The tags published posts actually carry, most used first.
 *
 * The hub editor offers these rather than a free-text box on its own, because
 * the failure it prevents is silent: a hub pointed at a tag no post uses
 * renders an empty page that is still in the sitemap, and nobody finds out
 * until Search Console says so weeks later.
 */
export const publishedPostTags = cache(async function publishedPostTags(): Promise<
  { tag: string; count: number }[]
> {
  const rows = await db.blogPost.findMany({
    where: { published: true },
    select: { tags: true },
  });
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const raw of row.tags) {
      const tag = raw.trim().toUpperCase();
      if (!tag) continue;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return Array.from(counts, ([tag, count]) => ({ tag, count })).sort(
    (a, b) => b.count - a.count || a.tag.localeCompare(b.tag)
  );
});

/**
 * The categories in use, for the post editor's suggestions.
 *
 * `category` is a free-text column and the form defaulted it to "Strategy" —
 * a value left over from the seller-facing blog that not one of the thirty
 * posts uses. Offering what exists stops the list fragmenting into
 * "Jewellery", "jewellery" and "Jewelry".
 */
export const publishedPostCategories = cache(async function publishedPostCategories(): Promise<
  { category: string; count: number }[]
> {
  const rows = await db.blogPost.groupBy({
    by: ['category'],
    where: { published: true },
    _count: { category: true },
  });
  return rows
    .map((r) => ({ category: r.category, count: r._count.category }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
});
