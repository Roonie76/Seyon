import type { Block } from '@/shared/blog/parse';
import { ProductCTA } from './ProductCTA/ProductCTA';
import { InlineNodes } from './inline-nodes';

/**
 * The article, as the reader sees it.
 *
 * Styling is unchanged from the hand-rolled renderer this replaced; what
 * changed is that the shapes it understands now come from one shared parser
 * rather than an `if` ladder only this file knew about.
 */

const H2 =
  'text-2xl sm:text-3xl font-light text-white font-serif tracking-tight mt-12 mb-4 uppercase';
const H3 =
  'text-xl sm:text-2xl font-light text-white font-serif tracking-tight mt-10 mb-3 uppercase';
const P = 'text-base sm:text-lg text-[#b5b5b5] leading-[1.85] font-light mb-6';
const QUOTE =
  'my-10 pl-6 border-l-2 border-[#D4AF37] font-serif italic text-lg sm:text-xl text-[#E4C29D] leading-relaxed';
const LIST = 'mb-6 space-y-2 text-base sm:text-lg text-[#b5b5b5] font-light leading-[1.85]';
const ITEM = 'marker:text-[#D4AF37] ml-6';

export function RenderBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block, i) => {
        switch (block.kind) {
          case 'product':
            return <ProductCTA key={i} slug={block.slug} />;
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
    </>
  );
}
