import Link from 'next/link';
import { BLOG_TOPICS } from '@/shared/blog/topics';

/**
 * Topic links, not a tag filter.
 *
 * This was a client component that pushed `?tag=X` onto /blog. Two problems.
 * The links were buttons, so nothing followed them but a browser with
 * JavaScript running -- a crawler saw no link at all. And the destination was
 * a query-parameter view of /blog, which search engines treat as a variant of
 * the same page rather than a page of its own, so those filtered views were
 * rarely indexed and never ranked.
 *
 * They are ordinary anchors to real hub URLs now. The hub list is fixed in
 * `shared/blog/topics`; the `tags` the page passes in are no longer used to
 * build the cloud, because an open-ended cloud built from whatever tags exist
 * in the database mints a new indexable URL for every typo an author makes.
 */
export function Tags() {
  return (
    <div className="space-y-6">
      <h4 className="text-[11px] font-black uppercase tracking-[0.25em] text-[#D4AF37] border-b border-zinc-900 pb-3">
        Topics
      </h4>
      <div className="flex flex-wrap gap-2">
        {BLOG_TOPICS.map((topic) => (
          <Link
            key={topic.slug}
            href={`/blog/topic/${topic.slug}`}
            className="px-4 py-2 text-[11px] font-black uppercase tracking-[0.15em] border rounded-sm transition-all duration-300 bg-[#0f0f0f] text-zinc-400 border-zinc-900 hover:bg-[#D4AF37] hover:text-black hover:border-[#D4AF37]"
          >
            {topic.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
