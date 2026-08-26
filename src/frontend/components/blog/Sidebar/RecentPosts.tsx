import Link from 'next/link';
import { BlogPost } from '@/types/blog';
import { Calendar } from 'lucide-react';

interface RecentPostsProps {
  posts: BlogPost[];
}

export function RecentPosts({ posts }: RecentPostsProps) {
  return (
    <div className="space-y-6">
      <h4 className="text-[11px] font-black uppercase tracking-[0.25em] text-[#D4AF37] border-b border-zinc-900 pb-3">
        Recent Articles
      </h4>
      <div className="space-y-4">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/blog/${post.slug}`}
            className="group flex gap-4 items-center p-2 rounded-sm hover:bg-zinc-950/40 transition-colors duration-300"
          >
            {/* Thumbnail */}
            <div className="h-16 w-16 shrink-0 rounded-sm overflow-hidden bg-zinc-900 border border-zinc-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.cover}
                alt=""
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>

            {/* Info */}
            <div className="space-y-1.5 transition-transform duration-300 group-hover:translate-x-1">
              <span className="flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.15em] text-zinc-500">
                <Calendar className="h-2.5 w-2.5 text-[#D4AF37]" />
                {new Date(post.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              <h5 className="text-xs font-light text-white leading-tight uppercase font-serif line-clamp-2 group-hover:text-[#E4C29D] transition-colors duration-300">
                {post.title}
              </h5>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
