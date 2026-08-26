'use client';

import { useRouter, useSearchParams } from 'next/navigation';

interface TagsProps {
  tags: string[];
}

export function Tags({ tags }: TagsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTag = searchParams.get('tag');

  const defaultTags = tags.length > 0 ? tags : ['GOLD', 'SILVER', 'DIAMOND', 'CRAFTSMANSHIP', '24K GOLD', 'MINIMALIST'];

  const handleTagClick = (tag: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const currentTag = params.get('tag');

    if (currentTag && currentTag.toLowerCase() === tag.toLowerCase()) {
      params.delete('tag');
    } else {
      params.set('tag', tag.toUpperCase());
    }
    params.delete('page'); // Reset pagination

    router.push(`/blog?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      <h4 className="text-[11px] font-black uppercase tracking-[0.25em] text-[#D4AF37] border-b border-zinc-900 pb-3">
        Tags
      </h4>
      <div className="flex flex-wrap gap-2">
        {defaultTags.map((tag) => {
          const isSelected = activeTag?.toUpperCase() === tag.toUpperCase();
          return (
            <button
              key={tag}
              type="button"
              onClick={() => handleTagClick(tag)}
              className={`px-4 py-2 text-[11px] font-black uppercase tracking-[0.15em] border rounded-sm transition-all duration-300 ${
                isSelected
                  ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                  : 'bg-[#0f0f0f] text-zinc-400 border-zinc-900 hover:bg-[#D4AF37] hover:text-black hover:border-[#D4AF37]'
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}
