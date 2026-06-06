'use client';

import * as React from 'react';
import Image from 'next/image';

interface ProductGalleryProps {
  images: { id: string; url: string; isPrimary: boolean }[];
}

export function ProductGallery({ images }: ProductGalleryProps) {
  // Sort images so primary comes first
  const sorted = React.useMemo(() => {
    return [...images].sort((a) => (a.isPrimary ? -1 : 1));
  }, [images]);

  const [prevImages, setPrevImages] = React.useState(images);
  const [activeIndex, setActiveIndex] = React.useState(0);

  if (images !== prevImages) {
    setPrevImages(images);
    setActiveIndex(0);
  }

  if (images.length === 0) {
    return (
      <div className="aspect-square w-full rounded-lg bg-zinc-800/50 border border-white/5 flex items-center justify-center text-muted-foreground text-sm">
        No images available
      </div>
    );
  }

  const activeImage = sorted[activeIndex]?.url || '';

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Big Active Image */}
      <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-zinc-900 border border-white/5 group shadow-xl">
        <Image
          src={activeImage}
          alt="Product Shot"
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          sizes="(max-width: 768px) 100vw, 50vw"
          priority
        />
      </div>

      {/* Thumbnails Row */}
      {sorted.length > 1 && (
        <div className="flex flex-wrap gap-3 mt-1">
          {sorted.map((img, idx) => (
            <button
              key={img.id}
              onClick={() => setActiveIndex(idx)}
              className={`relative h-16 w-16 md:h-20 md:w-20 rounded-md overflow-hidden bg-zinc-900 border-2 transition-all cursor-pointer ${
                activeIndex === idx ? 'border-primary shadow-md shadow-primary/20 scale-[1.03]' : 'border-white/5 hover:border-white/20'
              }`}
            >
              <Image
                src={img.url}
                alt="Thumbnail"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 64px, 80px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProductGallery;
