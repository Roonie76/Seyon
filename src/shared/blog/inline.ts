/**
 * Inline formatting for blog copy.
 *
 * The article renderer used to treat every non-heading, non-quote block as a
 * plain paragraph, so a writer following the form's own advice to use
 * "Standard Markdown" got asterisks and square brackets printed at the reader.
 *
 * This is deliberately a small grammar rather than a markdown library: the
 * blog's headings, quotes and product cards carry bespoke editorial styling
 * that a general renderer would have to be fought back into, and a parser that
 * never emits raw HTML cannot be talked into emitting a script tag. Everything
 * here returns data; React does the escaping.
 */

export type InlineNode =
  | { kind: 'text'; value: string }
  | { kind: 'strong'; children: InlineNode[] }
  | { kind: 'em'; children: InlineNode[] }
  | { kind: 'code'; value: string }
  | { kind: 'link'; href: string; children: InlineNode[] };

/**
 * Schemes a link may use.
 *
 * Anything else — `javascript:`, `data:`, `vbscript:` — is not rendered as a
 * link at all. The literal text is kept instead, so a mistake is visible to
 * whoever wrote it rather than silently disappearing.
 */
function safeHref(href: string): string | null {
  const trimmed = href.trim();
  if (trimmed === '') return null;
  // Relative paths and same-page anchors are always fine.
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^mailto:[^\s]+@[^\s]+$/i.test(trimmed)) return trimmed;
  return null;
}

interface Matcher {
  kind: 'code' | 'strong' | 'em' | 'link';
  re: RegExp;
}

// Order matters only for ties at the same index: code wins, so a backticked
// span stays literal even when it contains asterisks. `**` is tried before `*`
// for the same reason.
const MATCHERS: Matcher[] = [
  { kind: 'code', re: /`([^`\n]+)`/ },
  { kind: 'strong', re: /\*\*([^\n]+?)\*\*/ },
  { kind: 'strong', re: /__([^\n]+?)__/ },
  { kind: 'em', re: /\*([^*\n]+?)\*/ },
  { kind: 'em', re: /_([^_\n]+?)_/ },
  { kind: 'link', re: /\[([^\]\n]*)\]\(([^)\s]+)\)/ },
];

const MAX_DEPTH = 6;

/**
 * Collapse runs of adjacent text.
 *
 * A rejected link emits its source text and then continues parsing after it,
 * which would otherwise leave "[click](javascript:…" and ")" as two nodes
 * describing one piece of text.
 */
function mergeText(nodes: InlineNode[]): InlineNode[] {
  const out: InlineNode[] = [];
  for (const node of nodes) {
    const last = out[out.length - 1];
    if (node.kind === 'text' && last && last.kind === 'text') {
      out[out.length - 1] = { kind: 'text', value: last.value + node.value };
    } else {
      out.push(node);
    }
  }
  return out;
}

export function parseInline(source: string, depth = 0): InlineNode[] {
  if (source === '') return [];
  if (depth >= MAX_DEPTH) return [{ kind: 'text', value: source }];

  let best: { at: number; matcher: Matcher; m: RegExpMatchArray } | null = null;

  for (const matcher of MATCHERS) {
    const m = source.match(matcher.re);
    if (!m || m.index === undefined) continue;
    // Strictly earlier wins; on a tie the earlier matcher in the list wins,
    // which is what keeps code literal and `**` ahead of `*`.
    if (best === null || m.index < best.at) {
      best = { at: m.index, matcher, m };
    }
  }

  if (!best) return [{ kind: 'text', value: source }];

  const { at, matcher, m } = best;
  const before = source.slice(0, at);
  const after = source.slice(at + m[0].length);

  const out: InlineNode[] = [];
  if (before) out.push({ kind: 'text', value: before });

  if (matcher.kind === 'code') {
    out.push({ kind: 'code', value: m[1] });
  } else if (matcher.kind === 'link') {
    const href = safeHref(m[2]);
    if (href === null) {
      // Not a link we will follow. Keep the source text visible.
      out.push({ kind: 'text', value: m[0] });
    } else {
      const label = m[1] === '' ? href : m[1];
      out.push({ kind: 'link', href, children: parseInline(label, depth + 1) });
    }
  } else {
    out.push({ kind: matcher.kind, children: parseInline(m[1], depth + 1) });
  }

  out.push(...parseInline(after, depth + 1));
  return mergeText(out);
}

/** The text a set of nodes renders to, ignoring formatting. */
export function inlineToPlainText(nodes: InlineNode[]): string {
  return nodes
    .map((n) => {
      if (n.kind === 'text') return n.value;
      if (n.kind === 'code') return n.value;
      return inlineToPlainText(n.children);
    })
    .join('');
}
