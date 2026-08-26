import { describe, it, expect } from 'vitest';
import { parseBlocks, productSlugsIn, wordCount } from '../src/shared/blog/parse';
import { inlineToPlainText } from '../src/shared/blog/inline';

/**
 * Blog content, split into blocks.
 *
 * The article page and the admin preview both render this output, so a bug
 * here shows the writer the same wrong thing it shows the reader — which is
 * the point. Previously the two could not agree because only one existed.
 */

describe('parseBlocks', () => {
  it('returns nothing for empty content', () => {
    expect(parseBlocks('')).toEqual([]);
    expect(parseBlocks('   \n\n  ')).toEqual([]);
  });

  it('splits on a blank line', () => {
    const blocks = parseBlocks('One.\n\nTwo.');
    expect(blocks).toHaveLength(2);
    expect(blocks.map((b) => b.kind)).toEqual(['paragraph', 'paragraph']);
  });

  it('tolerates a blank line carrying whitespace', () => {
    expect(parseBlocks('One.\n   \nTwo.')).toHaveLength(2);
  });

  it('joins a wrapped paragraph into one line', () => {
    // Hard-wrapped source should not become a line break for the reader.
    const [block] = parseBlocks('A sentence\nwrapped by the editor.');
    expect(block).toMatchObject({ kind: 'paragraph', text: 'A sentence wrapped by the editor.' });
  });

  it('reads both heading levels', () => {
    expect(parseBlocks('## Section')[0]).toMatchObject({ kind: 'h2', text: 'Section' });
    expect(parseBlocks('### Smaller')[0]).toMatchObject({ kind: 'h3', text: 'Smaller' });
  });

  it('does not mistake a hash inside prose for a heading', () => {
    expect(parseBlocks('Costs #1 in the range')[0].kind).toBe('paragraph');
  });

  it('reads a quote, including a multi-line one', () => {
    const [block] = parseBlocks('> First line\n> second line');
    expect(block).toMatchObject({ kind: 'quote', text: 'First line second line' });
  });

  it('reads a bulleted list with either marker', () => {
    for (const src of ['- one\n- two', '* one\n* two']) {
      const [block] = parseBlocks(src);
      expect(block.kind).toBe('list');
      if (block.kind === 'list') {
        expect(block.ordered).toBe(false);
        expect(block.items.map(inlineToPlainText)).toEqual(['one', 'two']);
      }
    }
  });

  it('reads a numbered list and does not keep the writer\'s numbers', () => {
    const [block] = parseBlocks('1. one\n2. two\n3. three');
    expect(block.kind).toBe('list');
    if (block.kind === 'list') {
      expect(block.ordered).toBe(true);
      // The list element supplies the numbering; copying it would double it.
      expect(block.items.map(inlineToPlainText)).toEqual(['one', 'two', 'three']);
    }
  });

  it('does not treat a half-list as a list', () => {
    // One bullet among prose is prose; otherwise a stray hyphen changes the layout.
    expect(parseBlocks('- one\nnot a bullet')[0].kind).toBe('paragraph');
  });

  it('reads the product directive', () => {
    expect(parseBlocks('[shop-the-story:gold-bangle]')[0]).toEqual({
      kind: 'product',
      slug: 'gold-bangle',
    });
  });

  it('only reads the product directive when it is the whole block', () => {
    expect(parseBlocks('See [shop-the-story:x] here')[0].kind).toBe('paragraph');
  });

  it('carries inline formatting into every text-bearing block', () => {
    const [heading] = parseBlocks('## A **bold** section');
    expect(heading.kind === 'h2' && heading.inline.some((n) => n.kind === 'strong')).toBe(true);

    const [quote] = parseBlocks('> A *quiet* aside');
    expect(quote.kind === 'quote' && quote.inline.some((n) => n.kind === 'em')).toBe(true);

    const [list] = parseBlocks('- an [item](/x)');
    expect(list.kind === 'list' && list.items[0].some((n) => n.kind === 'link')).toBe(true);
  });

  it('keeps a realistic article in the right order', () => {
    const article = [
      '## Opening',
      'A paragraph with **weight**.',
      '> Something worth quoting.',
      '- one\n- two',
      '[shop-the-story:brass-lamp]',
      'A closing thought.',
    ].join('\n\n');

    expect(parseBlocks(article).map((b) => b.kind)).toEqual([
      'h2', 'paragraph', 'quote', 'list', 'product', 'paragraph',
    ]);
  });
});

describe('productSlugsIn', () => {
  it('finds every directive', () => {
    expect(productSlugsIn('[shop-the-story:a]\n\ntext\n\n[shop-the-story:b]')).toEqual(['a', 'b']);
  });

  it('reports each slug once', () => {
    expect(productSlugsIn('[shop-the-story:a]\n\n[shop-the-story:a]')).toEqual(['a']);
  });

  it('finds none in ordinary prose', () => {
    expect(productSlugsIn('Nothing to sell here.')).toEqual([]);
  });
});

describe('wordCount', () => {
  it('counts prose', () => {
    expect(wordCount('one two three')).toBe(3);
  });

  it('counts list items', () => {
    expect(wordCount('- one two\n- three')).toBe(3);
  });

  it('does not count a product directive as prose', () => {
    expect(wordCount('[shop-the-story:some-long-slug-name]')).toBe(0);
  });

  it('is zero for nothing', () => {
    expect(wordCount('')).toBe(0);
  });
});
