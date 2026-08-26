import Link from 'next/link';
import type { InlineNode } from '@/shared/blog/inline';

/**
 * Renders the inline grammar. Shared by the article page and the admin
 * preview so the writer and the reader cannot be shown different things.
 *
 * Every value here arrives as data from the parser and is placed as a React
 * child, so it is escaped. Nothing in this file emits HTML from a string.
 */
export function InlineNodes({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((node, i) => {
        switch (node.kind) {
          case 'text':
            return <span key={i}>{node.value}</span>;
          case 'strong':
            return (
              <strong key={i} className="font-semibold text-white">
                <InlineNodes nodes={node.children} />
              </strong>
            );
          case 'em':
            return (
              <em key={i} className="italic">
                <InlineNodes nodes={node.children} />
              </em>
            );
          case 'code':
            return (
              <code
                key={i}
                className="font-mono text-[0.9em] bg-zinc-900 text-[#E4C29D] px-1.5 py-0.5 rounded"
              >
                {node.value}
              </code>
            );
          case 'link': {
            const external = /^https?:\/\//i.test(node.href) || node.href.startsWith('mailto:');
            const className =
              'text-[#D4AF37] underline underline-offset-4 decoration-[#D4AF37]/40 hover:decoration-[#D4AF37] transition-colors';
            // An outbound link opens away from the article and carries no
            // referrer-based trust to the destination.
            return external ? (
              <a
                key={i}
                href={node.href}
                className={className}
                target="_blank"
                rel="noopener noreferrer nofollow"
              >
                <InlineNodes nodes={node.children} />
              </a>
            ) : (
              <Link key={i} href={node.href} className={className}>
                <InlineNodes nodes={node.children} />
              </Link>
            );
          }
        }
      })}
    </>
  );
}
