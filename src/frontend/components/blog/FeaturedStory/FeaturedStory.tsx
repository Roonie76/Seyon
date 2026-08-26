import Link from 'next/link';
import { BlogPost } from '@/types/blog';
import { Calendar, Clock, ArrowRight } from 'lucide-react';

interface FeaturedStoryProps {
  post: BlogPost;
}

export function FeaturedStory({ post }: FeaturedStoryProps) {
  return (
    <section className="w-full relative rounded-3xl overflow-hidden border border-zinc-900 bg-[#0f0f0f] h-[550px] md:h-[600px] group">
      {/* Background Cover Image */}
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={post.cover}
          alt={post.title}
          className="w-full h-full object-cover transition-transform duration-1000 ease-out group-hover:scale-105"
        />
        {/* Cinematic darken overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/20 to-transparent" />
      </div>

      {/* Floating Category Tag */}
      <div className="absolute top-6 left-6 z-20">
        <span className="bg-[#D4AF37] text-black text-[11px] font-black uppercase tracking-[0.25em] px-4 py-2 rounded-sm shadow-lg">
          {post.category}
        </span>
      </div>

      {/* Content */}
      <div className="absolute bottom-0 inset-x-0 p-8 sm:p-12 md:p-16 z-10 flex flex-col justify-end max-w-3xl space-y-4">
        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-4 text-[11px] font-bold uppercase tracking-[0.2em] text-[#9D9D9D]">
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-[#D4AF37]" />
            {new Date(post.date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
          <span>•</span>
          <span>BY {post.author.toUpperCase()}</span>
          <span>•</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-[#D4AF37]" />
            {post.readingTime} MIN READ
          </span>
        </div>

        {/* Title */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-light leading-[1.1] text-white font-serif tracking-tight uppercase group-hover:text-[#E4C29D] transition-colors duration-300">
          {post.title}
        </h2>

        {/* Excerpt */}
        <p className="text-sm text-[#b5b5b5] font-light leading-relaxed max-w-2xl line-clamp-3">
          {post.excerpt}
        </p>

        {/* CTA */}
        <div className="pt-4">
          <Link
            href={`/blog/${post.slug}`}
            className="group/btn inline-flex items-center gap-2 rounded-sm bg-[#D4AF37] px-8 py-3 text-xs font-black text-black tracking-[0.2em] uppercase transition-all duration-300 hover:bg-[#E4C29D] hover:shadow-[0_0_25px_rgba(212,175,55,0.2)]"
          >
            Read Story
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover/btn:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}
