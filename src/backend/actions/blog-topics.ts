'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { isCurrentUserAdmin } from '../lib/is-admin';
import { logger } from '../lib/logger';
import { BlogTopicInputSchema } from '@/shared/blog/topic-schema';

/**
 * Creating and editing blog hubs.
 *
 * The rules for what a hub may be live in `shared/blog/topic-schema`, next to
 * nothing that needs the database — a `'use server'` module may only export
 * async functions, so the constants and the schema cannot live here.
 */

/**
 * The shape every action in this codebase returns, and the one `runAction`
 * expects: an optional `error` the caller checks first. Not a discriminated
 * union — `runAction` turns a rejected promise into `{ error }`, and a union
 * with a required `success` cannot represent that.
 */
export interface BlogTopicActionResult {
  success?: boolean;
  id?: string;
  error?: string;
}

async function requireAdmin(): Promise<string | null> {
  if (!(await isCurrentUserAdmin())) return 'You do not have permission to do this.';
  return null;
}

/** Public hub pages, the index that lists them, and the sitemap. */
function revalidateTopicSurface(slug?: string): void {
  revalidatePath('/blog');
  revalidatePath('/blog/topic/[topic]', 'page');
  if (slug) revalidatePath(`/blog/topic/${slug}`);
  revalidatePath('/sitemap.xml');
  revalidatePath('/admin/blog/topics');
}

export async function createBlogTopic(input: unknown): Promise<BlogTopicActionResult> {
  const denied = await requireAdmin();
  if (denied) return { error: denied };

  const parsed = BlogTopicInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'That hub is not valid.' };
  }

  try {
    const existing = await db.blogTopic.findUnique({ where: { slug: parsed.data.slug } });
    if (existing) {
      return { error: `A hub already uses /blog/topic/${parsed.data.slug}.` };
    }
    const topic = await db.blogTopic.create({ data: parsed.data });
    revalidateTopicSurface(topic.slug);
    return { success: true, id: topic.id };
  } catch (error) {
    logger.error('Failed to create blog topic', { error });
    return { error: 'Could not save the hub.' };
  }
}

export async function updateBlogTopic(id: string, input: unknown): Promise<BlogTopicActionResult> {
  const denied = await requireAdmin();
  if (denied) return { error: denied };

  const parsed = BlogTopicInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'That hub is not valid.' };
  }

  try {
    const current = await db.blogTopic.findUnique({ where: { id } });
    if (!current) return { error: 'That hub no longer exists.' };

    if (parsed.data.slug !== current.slug) {
      const clash = await db.blogTopic.findUnique({ where: { slug: parsed.data.slug } });
      if (clash) return { error: `A hub already uses /blog/topic/${parsed.data.slug}.` };
    }

    const topic = await db.blogTopic.update({ where: { id }, data: parsed.data });
    // Both addresses: the old one so its cached page stops being served, the
    // new one so the renamed hub is built.
    revalidateTopicSurface(current.slug);
    revalidateTopicSurface(topic.slug);
    return { success: true, id: topic.id };
  } catch (error) {
    logger.error('Failed to update blog topic', { error, id });
    return { error: 'Could not save the hub.' };
  }
}

/**
 * Deleting a hub breaks any link to it that already exists in the wild, so
 * this is the one action that reports what it is about to orphan. Unpublishing
 * is the reversible option and the form says so.
 */
export async function deleteBlogTopic(id: string): Promise<BlogTopicActionResult> {
  const denied = await requireAdmin();
  if (denied) return { error: denied };

  try {
    const topic = await db.blogTopic.findUnique({ where: { id } });
    if (!topic) return { error: 'That hub no longer exists.' };
    await db.blogTopic.delete({ where: { id } });
    revalidateTopicSurface(topic.slug);
    return { success: true, id };
  } catch (error) {
    logger.error('Failed to delete blog topic', { error, id });
    return { error: 'Could not delete the hub.' };
  }
}

/**
 * How many published posts each hub would show.
 *
 * A hub matching nothing renders an empty page that is still in the sitemap,
 * which is the shape of thin content search engines penalise. The admin list
 * shows this count so an empty hub is visible rather than discovered later.
 */
export async function blogTopicPostCounts(): Promise<Record<string, number>> {
  const [topics, posts] = await Promise.all([
    db.blogTopic.findMany({ select: { id: true, tags: true } }),
    db.blogPost.findMany({ where: { published: true }, select: { tags: true } }),
  ]);
  const counts: Record<string, number> = {};
  for (const topic of topics) {
    const wanted = new Set(topic.tags.map((t) => t.toUpperCase()));
    counts[topic.id] = posts.filter((p) =>
      p.tags.some((tag) => wanted.has(tag.toUpperCase()))
    ).length;
  }
  return counts;
}
