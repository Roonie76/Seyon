'use client';

import type { Block } from '@/shared/blog/parse';
import { InlineNodes } from './inline-nodes';

/**
 * The article as the writer sees it, while writing.
 *
 * Renders the same blocks the reader will get, from the same parser, with one
 * unavoidable difference: a product card queries the database from a server
 * component, which cannot run here. That block is drawn as a labelled stand-in
 * showing the slug, so the writer can see where the card lands and check the
 * slug is the one they meant.
 *
 * The stand-in is deliberately obvious. A preview that invented a plausible
 * product would repeat the bug this work exists to remove.
 */

const H2 =
  'text-xl sm:text-2xl font-light text-white font-serif tracking-tight mt-8 mb-3 uppercase';
const H3 =
  'text-lg font-light text-white font-serif tracking-tight mt-6 mb-2 uppercase';
const P = 'text-sm text-[#b5b5b5] leading-[1.85] font-light mb-4';
const QUOTE =
  'my-6 pl-4 border-l-2 border-[#D4AF37] font-serif italic text-base text-[#E4C29D] leading-relaxed';
const LIST = 'mb-4 space-y-1.5 text-sm text-[#b5b5b5] font-light leading-[1.85]';
const ITEM = 'marker:text-[#D4AF37] ml-5';

export function PreviewBlocks({ blocks }: { blocks: Block[] }) {
  if (blocks.length === 0) {
    return (
      <p className="text-xs text-zinc-500 italic">
        Nothing to preview yet — start writing on the left.
      </p>
    );
  }

  return (
    <div className="bg-[#050505] rounded-lg p-5">
      {blocks.map((block, i) => {
        switch (block.kind) {
          case 'product':
            return (
              <div
                key={i}
                className="my-6 rounded-xl border border-dashed border-[#D4AF37]/50 bg-[#D4AF37]/5 px-4 py-3"
              >
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#D4AF37]">
                  Shop the story
                </p>
                <p className="mt-1 font-mono text-xs text-zinc-300 break-all">{block.slug}</p>
                <p className="mt-1 text-[11px] text-zinc-500">
                  The live product card renders here. Saving fails if no active product has
                  this slug.
                </p>
              </div>
            );
          case 'h2':
            return (
              <h2 key={i} className={H2}>
                <InlineNodes nodes={block.inline} />
              </h2>
            );
          case 'h3':
            return (
              <h3 key={i} className={H3}>
                <InlineNodes nodes={block.inline} />
              </h3>
            );
          case 'quote':
            return (
              <blockquote key={i} className={QUOTE}>
                <InlineNodes nodes={block.inline} />
              </blockquote>
            );
          case 'list':
            return block.ordered ? (
              <ol key={i} className={`${LIST} list-decimal`}>
                {block.items.map((item, j) => (
                  <li key={j} className={ITEM}>
                    <InlineNodes nodes={item} />
                  </li>
                ))}
              </ol>
            ) : (
              <ul key={i} className={`${LIST} list-disc`}>
                {block.items.map((item, j) => (
                  <li key={j} className={ITEM}>
                    <InlineNodes nodes={item} />
                  </li>
                ))}
              </ul>
            );
          case 'paragraph':
            return (
              <p key={i} className={P}>
                <InlineNodes nodes={block.inline} />
              </p>
            );
        }
      })}
    </div>
  );
}
