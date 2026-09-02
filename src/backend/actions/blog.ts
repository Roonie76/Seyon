'use server';

import { auth } from '@/lib/auth';
import { isCurrentUserAdmin } from '../lib/is-admin';
import { db } from '@/lib/db';
import { Role } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { logger } from '../lib/logger';
import { BlogPostInput } from '@/types/blog';
import { productSlugsIn, wordCount } from '@/shared/blog/parse';
import { checkCoverUrl } from '@/shared/blog/cover';

// Validation Schema for incoming blog inputs
const BlogPostInputSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase alphanumeric characters and hyphens'),
  excerpt: z.string().min(1, 'Excerpt is required'),
  /**
   * Presence only. The rule for what a cover may actually be lives in
   * `checkCoverUrl`, which `checkReferences` below applies to every write.
   *
   * This used to be `z.string().url()`, and that ran first - so it rejected
   * the root-relative `/blog/<slug>.webp` that every one of the 43 rows uses,
   * and no post could be saved from the admin screen at all. The form's own
   * client-side check accepts those paths, so the field looked valid right up
   * until the server refused it, on a field the editor had not touched.
   *
   * Two validators that disagree is the bug. There is one now.
   */
  cover: z.string().min(1, 'A cover image is required'),
  author: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  tags: z.array(z.string()),
  readingTime: z.number().int().min(1).optional(),
  featured: z.boolean().optional(),
  featuredProduct: z.string().nullable().optional(),
  seoTitle: z.string().nullable().optional(),
  seoDescription: z.string().nullable().optional(),
  seoKeywords: z.array(z.string()).optional(),
  content: z.string().min(1, 'Content is required'),
  published: z.boolean().optional(),
});

async function verifyAdminAuth() {
  const session = await auth();
  if (!(await isCurrentUserAdmin())) {
    throw new Error('Forbidden: Admin authorization required');
  }
  return session;
}

/** Calculate reading time (roughly 200 words per minute). */
function calculateReadingTime(content: string): number {
  // Counts prose only: a `[shop-the-story:…]` directive is a card, not
  // something the reader reads.
  return Math.max(1, Math.ceil(wordCount(content) / 200));
}

/**
 * Everything about a draft that has to be true before it is stored.
 *
 * Both create and update run this, because a post that was valid when written
 * can be edited into an invalid one, and the failure modes are all silent at
 * read time: a cover from a blocked host renders as an empty hero, and a
 * product slug that does not resolve used to render an invented product.
 */
async function checkReferences(parsed: {
  cover: string;
  content: string;
  featuredProduct?: string | null;
}): Promise<string | null> {
  const cover = checkCoverUrl(parsed.cover);
  if (!cover.ok) return cover.reason ?? 'The cover image is not usable.';

  const slugs = new Set(productSlugsIn(parsed.content));
  if (parsed.featuredProduct) slugs.add(parsed.featuredProduct.trim());
  if (slugs.size === 0) return null;

  const found = await db.product.findMany({
    where: { slug: { in: Array.from(slugs) }, status: 'ACTIVE' },
    select: { slug: true },
  });

  const known = new Set(found.map((p) => p.slug));
  const missing = Array.from(slugs).filter((s) => !known.has(s));

  if (missing.length > 0) {
    return missing.length === 1
      ? `No active product has the slug "${missing[0]}".`
      : `No active product has these slugs: ${missing.join(', ')}.`;
  }

  return null;
}

export async function getBlogPosts(options?: { publishedOnly?: boolean }) {
  try {
    const publishedOnly = options?.publishedOnly ?? true;

    const posts = await db.blogPost.findMany({
      where: publishedOnly ? { published: true } : undefined,
      orderBy: [
        { featured: 'desc' },
        { date: 'desc' },
      ],
    });

    return { success: true, posts };
  } catch (error) {
    logger.error('Error fetching blog posts', error);
    return { success: false, error: 'Failed to retrieve blog posts' };
  }
}

export async function getBlogPostBySlug(slug: string) {
  try {
    const post = await db.blogPost.findUnique({
      where: { slug },
    });

    if (!post) {
      return { success: false, error: 'Blog post not found' };
    }

    return { success: true, post };
  } catch (error) {
    logger.error('Error fetching blog post by slug', error);
    return { success: false, error: 'Failed to retrieve blog post' };
  }
}

/** The column values shared by create and update. */
function toRow(parsed: ReturnType<typeof BlogPostInputSchema.parse>, readingTime: number) {
  return {
    title: parsed.title,
    slug: parsed.slug,
    excerpt: parsed.excerpt,
    cover: parsed.cover,
    author: parsed.author || 'Seyon Team',
    category: parsed.category,
    tags: parsed.tags,
    readingTime,
    featured: parsed.featured ?? false,
    featuredProduct: parsed.featuredProduct ?? null,
    seoTitle: parsed.seoTitle ?? parsed.title,
    seoDescription: parsed.seoDescription ?? parsed.excerpt,
    seoKeywords: parsed.seoKeywords ?? [],
    content: parsed.content,
    published: parsed.published ?? true,
  };
}

export async function createBlogPost(data: BlogPostInput) {
  try {
    await verifyAdminAuth();

    const parsed = BlogPostInputSchema.parse(data);
    const readingTime = parsed.readingTime ?? calculateReadingTime(parsed.content);

    const existing = await db.blogPost.findUnique({ where: { slug: parsed.slug } });
    if (existing) {
      return { success: false, error: 'A blog post with this slug already exists' };
    }

    const badReference = await checkReferences(parsed);
    if (badReference) {
      return { success: false, error: badReference };
    }

    /**
     * One transaction, because these two statements only make sense together.
     * Unfeaturing every other post and then failing to insert this one leaves
     * the blog with no featured story and nothing to show for it.
     */
    const post = await db.$transaction(async (tx) => {
      if (parsed.featured) {
        await tx.blogPost.updateMany({
          where: { featured: true },
          data: { featured: false },
        });
      }
      return tx.blogPost.create({ data: toRow(parsed, readingTime) });
    });

    revalidatePath('/blog');
    revalidatePath(`/blog/${post.slug}`);
    revalidatePath('/admin/blog');

    return { success: true, post };
  } catch (error) {
    logger.error('Error creating blog post', error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message };
    }
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create blog post' };
  }
}

export async function updateBlogPost(id: string, data: BlogPostInput) {
  try {
    await verifyAdminAuth();

    const parsed = BlogPostInputSchema.parse(data);
    const readingTime = parsed.readingTime ?? calculateReadingTime(parsed.content);

    const clash = await db.blogPost.findFirst({
      where: { slug: parsed.slug, id: { not: id } },
    });
    if (clash) {
      return { success: false, error: 'A blog post with this slug already exists' };
    }

    const badReference = await checkReferences(parsed);
    if (badReference) {
      return { success: false, error: badReference };
    }

    const previous = await db.blogPost.findUnique({ where: { id }, select: { slug: true } });

    const post = await db.$transaction(async (tx) => {
      if (parsed.featured) {
        await tx.blogPost.updateMany({
          where: { featured: true, id: { not: id } },
          data: { featured: false },
        });
      }
      return tx.blogPost.update({ where: { id }, data: toRow(parsed, readingTime) });
    });

    revalidatePath('/blog');
    revalidatePath(`/blog/${post.slug}`);
    // A renamed post leaves its old address cached; clear that too.
    if (previous && previous.slug !== post.slug) {
      revalidatePath(`/blog/${previous.slug}`);
    }
    revalidatePath('/admin/blog');

    return { success: true, post };
  } catch (error) {
    logger.error('Error updating blog post', error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message };
    }
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update blog post' };
  }
}

export async function deleteBlogPost(id: string) {
  try {
    await verifyAdminAuth();

    const post = await db.blogPost.delete({
      where: { id },
    });

    // Revalidate paths
    revalidatePath('/blog');
    revalidatePath(`/blog/${post.slug}`);
    revalidatePath('/admin/blog');

    return { success: true };
  } catch (error) {
    logger.error('Error deleting blog post', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete blog post' };
  }
}
