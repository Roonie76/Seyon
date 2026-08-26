'use client';

import { BLOCK_SYNTAX, INLINE_SYNTAX } from '@/shared/blog/blocks';

/**
 * The cheatsheet, generated from the same list the renderer reads.
 *
 * The hint this replaced was three sentences of hand-written prose that
 * described three constructs, called them "Standard Markdown", and omitted
 * both `###` and the product directive. Anything added to BLOCK_SYNTAX appears
 * here without a second edit, and nothing can appear here that the parser does
 * not understand.
 */
export function SyntaxGuide({ onInsert }: { onInsert?: (snippet: string) => void }) {
  return (
    <div className="text-[10px] bg-zinc-950 rounded-md border border-border divide-y divide-border">
      <Group title="Blocks — each on its own, separated by a blank line" items={BLOCK_SYNTAX} onInsert={onInsert} />
      <Group title="Inline — anywhere within a line" items={INLINE_SYNTAX} onInsert={onInsert} />
    </div>
  );
}

function Group({
  title,
  items,
  onInsert,
}: {
  title: string;
  items: readonly { id: string; label: string; syntax: string; hint: string }[];
  onInsert?: (snippet: string) => void;
}) {
  return (
    <div className="p-2.5 space-y-1.5">
      <p className="font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <button
              type="button"
              onClick={() => onInsert?.(item.syntax)}
              disabled={!onInsert}
              className="font-mono text-[10px] bg-zinc-900 text-zinc-200 px-1.5 py-0.5 rounded border border-zinc-800 enabled:hover:border-primary enabled:hover:text-primary transition-colors text-left whitespace-pre disabled:cursor-default"
              title={onInsert ? 'Insert at the cursor' : undefined}
            >
              {item.syntax}
            </button>
            <span className="font-semibold text-foreground">{item.label}</span>
            <span className="text-muted-foreground">{item.hint}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
