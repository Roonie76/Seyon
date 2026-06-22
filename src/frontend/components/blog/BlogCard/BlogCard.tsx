import Link from 'next/link';
import { BlogPost } from '@/types/blog';
import { Calendar, Clock, ArrowRight } from 'lucide-react';

interface BlogCardProps {
  post: BlogPost;
}

export function BlogCard({ post }: BlogCardProps) {
  return (
    <article className="group flex flex-col h-full rounded-3xl overflow-hidden border border-zinc-900 bg-[#0f0f0f] transition-all duration-500 hover:border-zinc-800 hover:-translate-y-1 hover:shadow-[0_15px_30px_rgba(0,0,0,0.4)]">
      {/* Cover Image Container */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-950">
        {/* Category Pill Floating */}
        <span className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur-md border border-white/10 text-white text-[9px] font-black uppercase tracking-[0.2em] px-3.5 py-1.5 rounded-sm">
          {post.category}
        </span>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={post.cover}
          alt={post.title}
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          loading="lazy"
        />
      </div>

      {/* Card Info Content */}
      <div className="p-8 flex flex-col flex-grow space-y-4">
        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-3 text-[9px] font-black uppercase tracking-[0.15em] text-[#9D9D9D]">
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3 text-[#D4AF37]" />
            {new Date(post.date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
          <span className="text-zinc-800">•</span>
          <span>BY {post.author.toUpperCase()}</span>
          <span className="text-zinc-800">•</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3 text-[#D4AF37]" />
            {post.readingTime} MIN
          </span>
        </div>

        {/* Title */}
        <h3 className="text-xl sm:text-2xl font-light leading-snug text-white font-serif tracking-tight uppercase group-hover:text-[#E4C29D] transition-colors duration-300">
          <Link href={`/blog/${post.slug}`}>
            {post.title}
          </Link>
        </h3>

        {/* Excerpt */}
        <p className="text-sm text-[#b5b5b5] font-light leading-relaxed line-clamp-3 flex-grow">
          {post.excerpt}
        </p>

        {/* Action Button */}
        <div className="pt-4 border-t border-zinc-900/60 mt-auto">
          <Link
            href={`/blog/${post.slug}`}
            className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#D4AF37] hover:text-[#E4C29D] transition-colors duration-300"
          >
            Read Story
            <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </article>
  );
}
