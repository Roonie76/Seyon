import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  BLOG_TOPICS,
  topicBySlug,
  topicsForPost,
} from '../src/shared/blog/topics';

const ROOT = join(__dirname, '..');

describe('blog topic hubs', () => {
  it('has unique slugs', () => {
    const slugs = BLOG_TOPICS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('uses url-safe slugs', () => {
    for (const t of BLOG_TOPICS) {
      expect(t.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('declares tags in upper case, matching how posts store them', () => {
    for (const t of BLOG_TOPICS) {
      expect(t.tags.length).toBeGreaterThan(0);
      for (const tag of t.tags) expect(tag).toBe(tag.toUpperCase());
    }
  });

  it('gives every hub enough unique copy to not be a thin page', () => {
    for (const t of BLOG_TOPICS) {
      const words = t.intro.join(' ').split(/\s+/).filter(Boolean).length;
      expect(words, `${t.slug} intro`).toBeGreaterThan(50);
      expect(t.description.length, `${t.slug} description`).toBeGreaterThan(80);
    }
  });

  it('keeps hub titles inside the length search engines display', () => {
    // The root layout template appends " | Seyon" (8 characters), and search
    // results truncate around 60.
    for (const t of BLOG_TOPICS) {
      expect(t.seoTitle.length, `${t.slug} seoTitle`).toBeLessThanOrEqual(52);
      expect(t.description.length, `${t.slug} description`).toBeLessThanOrEqual(300);
    }
  });

  it('resolves by slug and rejects anything else', () => {
    expect(topicBySlug(BLOG_TOPICS[0].slug)?.slug).toBe(BLOG_TOPICS[0].slug);
    expect(topicBySlug('SELLING-ON-SOCIAL')?.slug).toBe('selling-on-social');
    expect(topicBySlug('not-a-topic')).toBeUndefined();
    expect(topicBySlug('')).toBeUndefined();
  });

  it('matches a post to hubs case-insensitively and in declaration order', () => {
    const found = topicsForPost(['operations', 'TRUST']);
    expect(found.map((t) => t.slug)).toEqual(
      BLOG_TOPICS.filter((t) => ['buyer-trust', 'running-your-shop'].includes(t.slug)).map(
        (t) => t.slug
      )
    );
  });

  it('returns no hubs for a post with no matching tags', () => {
    expect(topicsForPost(['SOMETHING-ELSE'])).toEqual([]);
    expect(topicsForPost([])).toEqual([]);
  });
});

describe('seeded posts', () => {
  it('reads the manifest it checks against', () => {
    expect(existsSync(join(ROOT, 'content', 'blog', 'manifest.json'))).toBe(true);
  });

  const manifestPath = join(ROOT, 'content', 'blog', 'manifest.json');
  const manifest: {
    slug: string;
    tags: string[];
    cover: string;
    featured: boolean;
    seoTitle: string;
    seoDescription: string;
  }[] = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : [];

  it('places every seeded post under at least one hub', () => {
    for (const post of manifest) {
      expect(topicsForPost(post.tags).length, post.slug).toBeGreaterThan(0);
    }
  });

  it('ships a cover file for every seeded post', () => {
    for (const post of manifest) {
      expect(post.cover).toMatch(/^\/blog\/[a-z0-9-]+\.webp$/);
      expect(existsSync(join(ROOT, 'public', post.cover)), post.cover).toBe(true);
    }
  });

  it('features exactly one post', () => {
    expect(manifest.filter((p) => p.featured).length).toBe(1);
  });

  it('leaves no hub empty', () => {
    for (const topic of BLOG_TOPICS) {
      const n = manifest.filter((p) => topicsForPost(p.tags).some((t) => t.slug === topic.slug));
      expect(n.length, `${topic.slug} has no posts`).toBeGreaterThan(0);
    }
  });
});

describe('shipped cover images', () => {
  const dir = join(ROOT, 'public', 'blog');

  it('are webp and small enough not to hurt the LCP they sit in', () => {
    const files = existsSync(dir) ? readdirSync(dir) : [];
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect(f, 'only webp covers are shipped').toMatch(/\.webp$/);
      const bytes = readFileSync(join(dir, f)).length;
      expect(bytes, `${f} is ${Math.round(bytes / 1024)}KB`).toBeLessThan(150 * 1024);
    }
  });
});
