import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBlogPost, updateBlogPost } from '../src/backend/actions/blog';
import { db } from '@/lib/db';
import { isCurrentUserAdmin } from '@/backend/lib/is-admin';

/**
 * What has to be true before a post is stored.
 *
 * Every failure these cover is silent at read time, which is why they are
 * checked at write time: a cover from a host the content policy blocks renders
 * as an empty hero, and a product slug that does not resolve used to render an
 * invented product with an invented price.
 */

vi.mock('@/lib/db', () => ({
  db: {
    blogPost: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    product: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock('@/lib/auth', () => ({ auth: vi.fn().mockResolvedValue({ user: { id: 'admin1' } }) }));
vi.mock('@/backend/lib/is-admin', () => ({ isCurrentUserAdmin: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

const mockDb = db as unknown as {
  blogPost: Record<string, ReturnType<typeof vi.fn>>;
  product: { findMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};
const asAdmin = isCurrentUserAdmin as unknown as ReturnType<typeof vi.fn>;

/** A cover on a host the content policy actually allows. */
const COVER = 'https://images.unsplash.com/photo-1?q=80';

function draft(over: Partial<Parameters<typeof createBlogPost>[0]> = {}) {
  return {
    title: 'A title',
    slug: 'a-title',
    excerpt: 'An excerpt.',
    cover: COVER,
    category: 'Strategy',
    tags: ['GOLD'],
    content: 'A paragraph of prose.',
    ...over,
  };
}

/** The transaction, running its callback against the same mocked client. */
function transactionRuns() {
  mockDb.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({ blogPost: mockDb.blogPost })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  asAdmin.mockResolvedValue(true);
  mockDb.blogPost.findUnique.mockResolvedValue(null);
  mockDb.blogPost.findFirst.mockResolvedValue(null);
  mockDb.blogPost.create.mockImplementation(async ({ data }: { data: { slug: string } }) => ({
    id: 'post1',
    ...data,
  }));
  mockDb.blogPost.update.mockImplementation(async ({ data }: { data: { slug: string } }) => ({
    id: 'post1',
    ...data,
  }));
  mockDb.blogPost.updateMany.mockResolvedValue({ count: 0 });
  mockDb.product.findMany.mockResolvedValue([]);
  transactionRuns();
});

describe('authorisation', () => {
  it('refuses a caller who is not an admin', async () => {
    asAdmin.mockResolvedValue(false);
    const result = await createBlogPost(draft());
    expect(result.success).toBe(false);
    expect(mockDb.blogPost.create).not.toHaveBeenCalled();
  });
});

describe('cover images', () => {
  it('refuses a host the content policy would block, and says which', async () => {
    const result = await createBlogPost(draft({ cover: 'https://i.imgur.com/a.jpg' }));
    expect(result.success).toBe(false);
    expect(result.error).toContain('i.imgur.com');
    expect(mockDb.blogPost.create).not.toHaveBeenCalled();
  });

  it('accepts Supabase storage', async () => {
    const result = await createBlogPost(
      draft({ cover: 'https://abc.supabase.co/storage/v1/object/public/banners/x.jpg' })
    );
    expect(result.success).toBe(true);
  });
});

describe('product references', () => {
  it('refuses a directive whose slug matches no active product', async () => {
    const result = await createBlogPost(
      draft({ content: 'Intro.\n\n[shop-the-story:ghost-item]' })
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('ghost-item');
    expect(mockDb.blogPost.create).not.toHaveBeenCalled();
  });

  it('accepts a directive that resolves', async () => {
    mockDb.product.findMany.mockResolvedValue([{ slug: 'real-item' }]);
    const result = await createBlogPost(
      draft({ content: 'Intro.\n\n[shop-the-story:real-item]' })
    );
    expect(result.success).toBe(true);
  });

  it('checks the sidebar product too, not only the directives', async () => {
    const result = await createBlogPost(draft({ featuredProduct: 'ghost-item' }));
    expect(result.success).toBe(false);
    expect(result.error).toContain('ghost-item');
  });

  it('only looks up active products', async () => {
    mockDb.product.findMany.mockResolvedValue([{ slug: 'real-item' }]);
    await createBlogPost(draft({ content: '[shop-the-story:real-item]' }));
    expect(mockDb.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'ACTIVE' }),
      })
    );
  });

  it('names every unresolved slug at once', async () => {
    const result = await createBlogPost(
      draft({ content: '[shop-the-story:a]\n\n[shop-the-story:b]' })
    );
    expect(result.error).toContain('a');
    expect(result.error).toContain('b');
  });
});

describe('the featured story', () => {
  it('clears the previous featured post inside the same transaction', async () => {
    const result = await createBlogPost(draft({ featured: true }));
    expect(result.success).toBe(true);
    expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
    expect(mockDb.blogPost.updateMany).toHaveBeenCalledWith({
      where: { featured: true },
      data: { featured: false },
    });
  });

  it('does not touch the previous featured post when the save is refused', async () => {
    // The regression: unfeaturing everything used to happen first and outside a
    // transaction, so a rejected save left the blog with no featured story.
    const result = await createBlogPost(
      draft({ featured: true, cover: 'https://i.imgur.com/a.jpg' })
    );
    expect(result.success).toBe(false);
    expect(mockDb.blogPost.updateMany).not.toHaveBeenCalled();
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it('leaves other posts alone when this one is not featured', async () => {
    await createBlogPost(draft({ featured: false }));
    expect(mockDb.blogPost.updateMany).not.toHaveBeenCalled();
  });

  it('excludes itself when updating', async () => {
    await updateBlogPost('post1', draft({ featured: true }));
    expect(mockDb.blogPost.updateMany).toHaveBeenCalledWith({
      where: { featured: true, id: { not: 'post1' } },
      data: { featured: false },
    });
  });
});

describe('slugs', () => {
  it('refuses a slug already taken', async () => {
    mockDb.blogPost.findUnique.mockResolvedValue({ id: 'other' });
    const result = await createBlogPost(draft());
    expect(result.success).toBe(false);
    expect(result.error).toContain('already exists');
  });

  it('refuses a slug that is not url-safe', async () => {
    const result = await createBlogPost(draft({ slug: 'Not A Slug' }));
    expect(result.success).toBe(false);
  });
});

describe('reading time', () => {
  it('counts prose', async () => {
    const words = Array.from({ length: 400 }, () => 'word').join(' ');
    await createBlogPost(draft({ content: words }));
    expect(mockDb.blogPost.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ readingTime: 2 }) })
    );
  });

  it('does not count a product directive as something to read', async () => {
    mockDb.product.findMany.mockResolvedValue([{ slug: 'x' }]);
    await createBlogPost(draft({ content: 'Two words.\n\n[shop-the-story:x]' }));
    expect(mockDb.blogPost.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ readingTime: 1 }) })
    );
  });
});
