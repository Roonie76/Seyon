/**
 * The blog's authoring vocabulary — one definition, three consumers.
 *
 * This list is what the article renderer understands, what the admin form's
 * cheatsheet advertises, and what the live preview draws. Before it existed
 * those three disagreed: the renderer knew four constructs, the form's hint
 * text described three of them and called the result "Standard Markdown", and
 * nothing showed the writer the outcome until after publishing.
 *
 * Adding a construct means adding one entry here and one arm to each renderer.
 * It cannot be added to the renderer and forgotten in the documentation,
 * because the documentation is generated from this array.
 */

export interface BlockSyntax {
  id: string;
  /** What it is called in the editor. */
  label: string;
  /** The shape the writer types. */
  syntax: string;
  /** A one-line description shown beside it. */
  hint: string;
}

export const BLOCK_SYNTAX: readonly BlockSyntax[] = [
  { id: 'h2', label: 'Section', syntax: '## Heading', hint: 'A major section break.' },
  { id: 'h3', label: 'Sub-section', syntax: '### Heading', hint: 'A heading inside a section.' },
  { id: 'quote', label: 'Pull quote', syntax: '> Quoted line', hint: 'Set in serif, with a gold rule.' },
  { id: 'ul', label: 'Bulleted list', syntax: '- First\n- Second', hint: 'One item per line.' },
  { id: 'ol', label: 'Numbered list', syntax: '1. First\n2. Second', hint: 'Numbering is rendered, not copied.' },
  {
    id: 'product',
    label: 'Shop the story',
    syntax: '[shop-the-story:product-slug]',
    hint: 'Embeds a live product card. The slug must belong to an active product.',
  },
] as const;

export const INLINE_SYNTAX: readonly BlockSyntax[] = [
  { id: 'strong', label: 'Bold', syntax: '**bold**', hint: 'Also __bold__.' },
  { id: 'em', label: 'Italic', syntax: '*italic*', hint: 'Also _italic_.' },
  { id: 'code', label: 'Code', syntax: '`code`', hint: 'Monospaced, never formatted.' },
  {
    id: 'link',
    label: 'Link',
    syntax: '[text](https://example.com)',
    hint: 'http, https, mailto, or a path starting with /. Anything else is left as plain text.',
  },
] as const;

/** Separate a paragraph from the next one. */
export const BLOCK_SEPARATOR = '\n\n';
