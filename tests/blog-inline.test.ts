import { describe, it, expect } from 'vitest';
import { parseInline, inlineToPlainText } from '../src/shared/blog/inline';

/**
 * The blog's inline grammar.
 *
 * Before this existed the article renderer printed every paragraph verbatim,
 * so a writer following the admin form's own advice to use "Standard Markdown"
 * published asterisks and square brackets to readers.
 */

const text = (v: string) => ({ kind: 'text', value: v });

describe('parseInline', () => {
  it('leaves plain prose alone', () => {
    expect(parseInline('Just a sentence.')).toEqual([text('Just a sentence.')]);
  });

  it('reads bold, in both spellings', () => {
    expect(parseInline('a **b** c')).toEqual([
      text('a '),
      { kind: 'strong', children: [text('b')] },
      text(' c'),
    ]);
    expect(parseInline('__b__')).toEqual([{ kind: 'strong', children: [text('b')] }]);
  });

  it('reads italic, in both spellings', () => {
    expect(parseInline('*b*')).toEqual([{ kind: 'em', children: [text('b')] }]);
    expect(parseInline('_b_')).toEqual([{ kind: 'em', children: [text('b')] }]);
  });

  it('prefers bold over italic when both could match', () => {
    // "**x**" must not be read as an empty italic wrapping "x".
    expect(parseInline('**x**')).toEqual([{ kind: 'strong', children: [text('x')] }]);
  });

  it('keeps code literal, including markup inside it', () => {
    expect(parseInline('use `**not bold**` here')).toEqual([
      text('use '),
      { kind: 'code', value: '**not bold**' },
      text(' here'),
    ]);
  });

  it('nests formatting', () => {
    expect(parseInline('**bold with _italic_ inside**')).toEqual([
      {
        kind: 'strong',
        children: [text('bold with '), { kind: 'em', children: [text('italic')] }, text(' inside')],
      },
    ]);
  });

  it('reads links and keeps the label', () => {
    expect(parseInline('[Seyon](https://seyon-pied.vercel.app)')).toEqual([
      {
        kind: 'link',
        href: 'https://seyon-pied.vercel.app',
        children: [text('Seyon')],
      },
    ]);
  });

  it('accepts relative paths, anchors and mailto', () => {
    for (const href of ['/marketplace', '#section', 'mailto:hello@example.com']) {
      const [node] = parseInline(`[go](${href})`);
      expect(node).toMatchObject({ kind: 'link', href });
    }
  });

  it('refuses a script URL and leaves the source visible', () => {
    // Not silently dropped: the writer sees their own mistake on the page.
    const out = parseInline('[click](javascript:alert(1))');
    expect(out).toEqual([text('[click](javascript:alert(1))')]);
    expect(out.some((n) => n.kind === 'link')).toBe(false);
  });

  it('refuses a data URL', () => {
    const out = parseInline('[x](data:text/html;base64,PHNjcmlwdD4=)');
    expect(out.some((n) => n.kind === 'link')).toBe(false);
  });

  it('leaves an unclosed delimiter as text rather than eating the rest', () => {
    expect(parseInline('a ** b')).toEqual([text('a ** b')]);
    expect(parseInline('an asterisk * on its own')).toEqual([text('an asterisk * on its own')]);
  });

  it('handles several constructs in one line', () => {
    const out = parseInline('**A**, *B*, `C`, [D](/d)');
    expect(out.map((n) => n.kind)).toEqual([
      'strong', 'text', 'em', 'text', 'code', 'text', 'link',
    ]);
  });

  it('terminates on adversarial nesting rather than recursing forever', () => {
    const deep = '*'.repeat(40) + 'x' + '*'.repeat(40);
    expect(() => parseInline(deep)).not.toThrow();
  });

  it('round-trips to plain text', () => {
    expect(inlineToPlainText(parseInline('**bold** and `code` and [a](/b)'))).toBe(
      'bold and code and a'
    );
  });
});
