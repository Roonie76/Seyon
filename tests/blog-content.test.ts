/**
 * The seeded articles, checked through the same parser the live page uses.
 *
 * Content bugs in this project have historically been invisible until
 * production, because the database was empty and nothing rendered. Running the
 * real `parseBlocks` over the real markdown catches a stray `##`, an unclosed
 * `**`, or a link the sanitiser will drop, before it is inserted rather than
 * after somebody reads it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseBlocks, wordCount } from '../src/shared/blog/parse';
import { inlineToPlainText } from '../src/shared/blog/inline';
import { checkCoverUrl } from '../src/shared/blog/cover';
import type { InlineNode } from '../src/shared/blog/inline';

const MD_DIR = join(__dirname, '..', 'content', 'blog');
const files = existsSync(MD_DIR)
  ? readdirSync(MD_DIR)
      .filter((f) => f.endsWith('.md'))
      // README.md documents the directory; it is not an article.
      .filter((f) => f !== 'README.md')
  : [];

function flatten(nodes: InlineNode[]): InlineNode[] {
  return nodes.flatMap((n) =>
    n.kind === 'strong' || n.kind === 'em' || n.kind === 'link'
      ? [n, ...flatten(n.children)]
      : [n]
  );
}

describe('seeded article markdown', () => {
  it('finds the article sources it is meant to check', () => {
    // Without this, every assertion below would pass vacuously if the content
    // directory were moved or emptied.
    expect(files.length).toBeGreaterThanOrEqual(10);
  });

  const posts = files.map((f) => ({ file: f, body: readFileSync(join(MD_DIR, f), 'utf8').trim() }));

  it('parses every file into blocks', () => {
    for (const { file, body } of posts) {
      expect(parseBlocks(body).length, file).toBeGreaterThan(5);
    }
  });

  it('leaves no unconsumed block markers in paragraph text', () => {
    for (const { file, body } of posts) {
      for (const block of parseBlocks(body)) {
        if (block.kind !== 'paragraph') continue;
        expect(block.text, `${file}: "${block.text.slice(0, 60)}"`).not.toMatch(/^#{1,6}\s/);
        expect(block.text, file).not.toMatch(/^>\s/);
      }
    }
  });

  it('leaves no unbalanced emphasis markers in rendered text', () => {
    for (const { file, body } of posts) {
      for (const block of parseBlocks(body)) {
        if (!('inline' in block)) continue;
        const text = inlineToPlainText(block.inline);
        expect(text, `${file}: "${text.slice(0, 60)}"`).not.toContain('**');
      }
    }
  });

  it('drops no links to the href sanitiser', () => {
    for (const { file, body } of posts) {
      const raw = (body.match(/\[[^\]]+\]\([^)]+\)/g) || []).length;
      let kept = 0;
      for (const block of parseBlocks(body)) {
        if (!('inline' in block)) continue;
        kept += flatten(block.inline).filter((n) => n.kind === 'link').length;
      }
      // Ordered/unordered list items carry their own inline arrays.
      for (const block of parseBlocks(body)) {
        if (block.kind !== 'list') continue;
        for (const item of block.items) kept += flatten(item).filter((n) => n.kind === 'link').length;
      }
      expect(kept, `${file}: ${raw} markdown links, ${kept} survived`).toBe(raw);
    }
  });

  it('opens with a paragraph rather than a heading', () => {
    for (const { file, body } of posts) {
      expect(parseBlocks(body)[0].kind, file).toBe('paragraph');
    }
  });

  it('uses h2 before any h3', () => {
    for (const { file, body } of posts) {
      const headings = parseBlocks(body).filter((b) => b.kind === 'h2' || b.kind === 'h3');
      if (headings.length === 0) continue;
      expect(headings[0].kind, `${file} starts its outline at h3`).toBe('h2');
    }
  });

  it('is long enough to be worth ranking', () => {
    for (const { file, body } of posts) {
      expect(wordCount(body), file).toBeGreaterThan(600);
    }
  });

  it('links only to articles that exist', () => {
    // Only the live set counts. A link to a retired post is a link to a 404,
    // because an unpublished post is notFound() rather than merely unlisted --
    // which is the whole reason `retired/` is a subdirectory this glob skips.
    const slugs = new Set(files.map((f) => f.replace(/\.md$/, '')));
    let total = 0;
    for (const { file, body } of posts) {
      for (const [, href] of body.matchAll(/\]\((\/blog\/[^)#?]+)\)/g)) {
        total += 1;
        const target = href.split('/').pop()!;
        expect(slugs.has(target), `${file} links to /blog/${target}, which does not exist`).toBe(true);
      }
    }
    // Guards the guard: if the links are ever stripped, this test would pass
    // vacuously and stop protecting anything.
    expect(total, 'no internal links found to check').toBeGreaterThan(10);
  });

  it('accepts every seeded cover path', () => {
    const manifestPath = join(__dirname, '..', 'content', 'blog', 'manifest.json');
    if (!existsSync(manifestPath)) return;
    const manifest: { cover: string; slug: string }[] = JSON.parse(readFileSync(manifestPath, 'utf8'));
    for (const post of manifest) {
      expect(checkCoverUrl(post.cover), post.slug).toEqual({ ok: true });
    }
  });
});
