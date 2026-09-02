/**
 * The article parser, checked against the shapes that have broken it.
 *
 * This file used to read `content/blog/*.md` and run the parser over the
 * thirty seeded articles. That was the right test while the markdown was the
 * source of truth. It stopped being the right test the moment editing moved to
 * the admin screen: the files became a stale second copy, and a corpus test
 * reading them could report a clean blog while every live article was broken.
 * When the files were moved to `content/blog/archive/`, this file's own
 * "guards the guard" assertion caught the vacuity — 0 links found where it
 * expected more than 10 — which is the only reason the retirement was noticed
 * rather than silently passing forever.
 *
 * What remains here is what belongs in a unit test: the parser's behaviour on
 * the inputs that have caused trouble, stated as fixtures so they are readable
 * and so this file cannot go vacuous again.
 *
 * The corpus-wide checks — every article long enough, every internal link
 * resolving, every cover accepted, headings in order — are now
 * `npm run blog:doctor`, which reads a real database and can therefore see an
 * article somebody published five minutes ago.
 */
import { describe, it, expect } from 'vitest';
import { parseBlocks, wordCount, productSlugsIn } from '../src/shared/blog/parse';
import { inlineToPlainText } from '../src/shared/blog/inline';
import type { InlineNode } from '../src/shared/blog/inline';

function flatten(nodes: InlineNode[]): InlineNode[] {
  return nodes.flatMap((n) =>
    n.kind === 'strong' || n.kind === 'em' || n.kind === 'link'
      ? [n, ...flatten(n.children)]
      : [n]
  );
}

const ARTICLE = [
  'An opening paragraph, because starting on a heading duplicates the h1.',
  '## A section',
  'Body text with **strong** and *emphasis* and a [link](/blog/other-post).',
  '### A subsection',
  '- first item',
  '- second item',
  '> A pulled quote.',
  '[shop-the-story:a-product-slug]',
  'A closing paragraph.',
].join('\n\n');

describe('parsing an article', () => {
  const blocks = parseBlocks(ARTICLE);

  it('produces one block per separated chunk', () => {
    expect(blocks.length).toBe(9);
  });

  it('recognises each kind of block', () => {
    expect(blocks.map((b) => b.kind)).toEqual([
      'paragraph',
      'h2',
      'paragraph',
      'h3',
      'list',
      'list',
      'quote',
      'product',
      'paragraph',
    ]);
  });

  it('strips the marker rather than leaving it in the text', () => {
    // A `##` or `>` surviving into paragraph text is rendered to the reader
    // verbatim, which is how a heading ends up looking like body copy.
    for (const block of blocks) {
      if (block.kind !== 'paragraph') continue;
      expect(block.text).not.toMatch(/^#{1,6}\s/);
      expect(block.text).not.toMatch(/^>\s/);
    }
    const h2 = blocks.find((b) => b.kind === 'h2');
    expect(h2 && 'text' in h2 && h2.text).toBe('A section');
  });

  it('leaves no emphasis markers in the rendered text', () => {
    for (const block of blocks) {
      if (!('inline' in block)) continue;
      const text = inlineToPlainText(block.inline);
      expect(text).not.toContain('**');
      // A single asterisk surviving means an unclosed marker.
      expect(text).not.toMatch(/(^|\s)\*(\S)/);
    }
  });

  it('keeps links as links, with their href intact', () => {
    const links = blocks
      .filter((b) => 'inline' in b)
      .flatMap((b) => flatten((b as { inline: InlineNode[] }).inline))
      .filter((n) => n.kind === 'link');
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ kind: 'link', href: '/blog/other-post' });
  });

  it('extracts the product slugs a post embeds', () => {
    expect(productSlugsIn(ARTICLE)).toEqual(['a-product-slug']);
  });
});

describe('parsing what an editor might actually paste', () => {
  it('survives an empty body without throwing', () => {
    expect(parseBlocks('')).toEqual([]);
  });

  it('treats a run of blank lines as one separator', () => {
    expect(parseBlocks('One.\n\n\n\n\nTwo.').length).toBe(2);
  });

  it('does not turn a mid-sentence hash into a heading', () => {
    const [block] = parseBlocks('A price of #1 in the range.');
    expect(block.kind).toBe('paragraph');
  });

  it('counts words without counting markup', () => {
    // Used to decide whether an article is long enough to rank; counting the
    // syntax would inflate every number by a few percent.
    expect(wordCount('## Heading\n\nTwo words.')).toBeLessThan(
      wordCount('## Heading\n\nTwo words. And three more.')
    );
    expect(wordCount('')).toBe(0);
  });

  it('leaves an unresolved marker visible rather than swallowing it', () => {
    // The doctor script fails on this, so it must be detectable: a marker the
    // parser does not recognise has to stay in the text where a check can see
    // it, not disappear into nothing.
    const [block] = parseBlocks('[unknown-marker:something] in a sentence.');
    expect(block.kind).toBe('paragraph');
    expect('text' in block && block.text).toContain('[unknown-marker:something]');
  });
});
