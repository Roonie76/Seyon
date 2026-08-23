'use server';

import { auth } from '@/lib/auth';
import { isCurrentUserAdmin } from '../lib/is-admin';
import { db } from '@/lib/db';
import { Role } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { logger } from '../lib/logger';
import { BlogPostInput } from '@/types/blog';

// Validation Schema for incoming blog inputs
const BlogPostInputSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase alphanumeric characters and hyphens'),
  excerpt: z.string().min(1, 'Excerpt is required'),
  cover: z.string().url('Cover image must be a valid URL'),
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

/** Calculate reading time (roughly 200 words per minute) */
function calculateReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
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

export async function createBlogPost(data: BlogPostInput) {
  try {
    await verifyAdminAuth();

    const parsed = BlogPostInputSchema.parse(data);

    // Compute reading time if not supplied
    const computedReadingTime = parsed.readingTime ?? calculateReadingTime(parsed.content);

    // Check slug uniqueness
    const existing = await db.blogPost.findUnique({
      where: { slug: parsed.slug },
    });

    if (existing) {
      return { success: false, error: 'A blog post with this slug already exists' };
    }

    // If this post is marked featured, unfeature previous posts
    if (parsed.featured) {
      await db.blogPost.updateMany({
        where: { featured: true },
        data: { featured: false },
      });
    }

    const post = await db.blogPost.create({
      data: {
        title: parsed.title,
        slug: parsed.slug,
        excerpt: parsed.excerpt,
        cover: parsed.cover,
        author: parsed.author || 'Seyon Team',
        category: parsed.category,
        tags: parsed.tags,
        readingTime: computedReadingTime,
        featured: parsed.featured ?? false,
        featuredProduct: parsed.featuredProduct ?? null,
        seoTitle: parsed.seoTitle ?? parsed.title,
        seoDescription: parsed.seoDescription ?? parsed.excerpt,
        seoKeywords: parsed.seoKeywords ?? [],
        content: parsed.content,
        published: parsed.published ?? true,
      },
    });

    // Revalidate paths for static update
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

    // Compute reading time
    const computedReadingTime = parsed.readingTime ?? calculateReadingTime(parsed.content);

    // Check slug uniqueness against other posts
    const existing = await db.blogPost.findFirst({
      where: {
        slug: parsed.slug,
        id: { not: id },
      },
    });

    if (existing) {
      return { success: false, error: 'A blog post with this slug already exists' };
    }

    // If this post is marked featured, unfeature previous posts
    if (parsed.featured) {
      await db.blogPost.updateMany({
        where: {
          featured: true,
          id: { not: id },
        },
        data: { featured: false },
      });
    }

    const post = await db.blogPost.update({
      where: { id },
      data: {
        title: parsed.title,
        slug: parsed.slug,
        excerpt: parsed.excerpt,
        cover: parsed.cover,
        author: parsed.author || 'Seyon Team',
        category: parsed.category,
        tags: parsed.tags,
        readingTime: computedReadingTime,
        featured: parsed.featured ?? false,
        featuredProduct: parsed.featuredProduct ?? null,
        seoTitle: parsed.seoTitle ?? parsed.title,
        seoDescription: parsed.seoDescription ?? parsed.excerpt,
        seoKeywords: parsed.seoKeywords ?? [],
        content: parsed.content,
        published: parsed.published ?? true,
      },
    });

    // Revalidate paths
    revalidatePath('/blog');
    revalidatePath(`/blog/${post.slug}`);
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
