/**
 * Blog content, from markdown text to a list of blocks.
 *
 * Pure: no React, no database, no environment. The article page and the
 * admin preview both render the output of this function, which is what stops
 * the editor from showing one thing and the reader seeing another.
 *
 * Block splitting is on a blank line, matching what the previous inline
 * renderer did, so existing content keeps its shape.
 */

import { parseInline, inlineToPlainText, type InlineNode } from './inline';

export type Block =
  | { kind: 'h2'; text: string; inline: InlineNode[] }
  | { kind: 'h3'; text: string; inline: InlineNode[] }
  | { kind: 'quote'; text: string; inline: InlineNode[] }
  | { kind: 'product'; slug: string }
  | { kind: 'list'; ordered: boolean; items: InlineNode[][] }
  | { kind: 'paragraph'; text: string; inline: InlineNode[] };

const PRODUCT_RE = /^\[shop-the-story:(.+)\]$/;
const BULLET_RE = /^[-*]\s+(.*)$/;
const ORDERED_RE = /^\d+[.)]\s+(.*)$/;

export function parseBlocks(markdown: string): Block[] {
  if (!markdown) return [];

  return markdown
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map(classify);
}

function classify(block: string): Block {
  const product = block.match(PRODUCT_RE);
  if (product) return { kind: 'product', slug: product[1].trim() };

  if (block.startsWith('### ')) {
    const text = block.slice(4).trim();
    return { kind: 'h3', text, inline: parseInline(text) };
  }
  if (block.startsWith('## ')) {
    const text = block.slice(3).trim();
    return { kind: 'h2', text, inline: parseInline(text) };
  }

  if (block.startsWith('>')) {
    // A multi-line quote is one quote, not one per line.
    const text = block
      .split('\n')
      .map((l) => l.replace(/^>\s?/, ''))
      .join(' ')
      .trim();
    return { kind: 'quote', text, inline: parseInline(text) };
  }

  const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);

  if (lines.length > 0 && lines.every((l) => BULLET_RE.test(l))) {
    return {
      kind: 'list',
      ordered: false,
      items: lines.map((l) => parseInline(l.match(BULLET_RE)![1].trim())),
    };
  }
  if (lines.length > 0 && lines.every((l) => ORDERED_RE.test(l))) {
    return {
      kind: 'list',
      ordered: true,
      items: lines.map((l) => parseInline(l.match(ORDERED_RE)![1].trim())),
    };
  }

  // A wrapped paragraph is one paragraph; the newlines are the writer's, not
  // the reader's.
  const text = lines.join(' ');
  return { kind: 'paragraph', text, inline: parseInline(text) };
}

/**
 * Every product slug the content asks for.
 *
 * Used at save time so a mistyped slug is refused while the writer is looking
 * at it, rather than rendering as nothing (or, before this, as an invented
 * product) once it is published.
 */
export function productSlugsIn(markdown: string): string[] {
  return Array.from(
    new Set(
      parseBlocks(markdown)
        .filter((b): b is Extract<Block, { kind: 'product' }> => b.kind === 'product')
        .map((b) => b.slug)
    )
  );
}

/** Words in the prose, ignoring directives. Drives the reading-time estimate. */
export function wordCount(markdown: string): number {
  const words = parseBlocks(markdown)
    .flatMap((b) => {
      if (b.kind === 'product') return [];
      if (b.kind === 'list') return b.items.map(inlineToPlainText);
      return [b.text];
    })
    .join(' ')
    .trim();
  return words === '' ? 0 : words.split(/\s+/).length;
}
