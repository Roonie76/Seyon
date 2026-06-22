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
      <div className="relative w-full h-[320px] sm:h-[400px] md:h-[430px] rounded-2xl overflow-hidden bg-white border border-zinc-200 group shadow-xs">
        <Image
          src={activeImage}
          alt="Product Shot"
          fill
          className="object-contain object-center p-3 transition-transform duration-300 group-hover:scale-[1.01]"
          style={{ objectPosition: 'center' }}
          sizes="(max-width: 768px) 100vw, 50vw"
          priority
        />
      </div>

      {/* Thumbnails Row */}
      {sorted.length > 1 && (
        <div className="flex gap-3 mt-1 overflow-x-auto no-scrollbar pb-1.5 scroll-smooth flex-nowrap w-full">
          {sorted.map((img, idx) => (
            <button
              key={img.id}
              onClick={() => setActiveIndex(idx)}
              className={`relative h-16 w-16 md:h-20 md:w-20 shrink-0 rounded-xl overflow-hidden bg-white border-2 transition-all cursor-pointer ${
                activeIndex === idx ? 'border-primary shadow-sm scale-[1.03]' : 'border-zinc-200 hover:border-zinc-350'
              }`}
            >
              <Image
                src={img.url}
                alt="Thumbnail"
                fill
                className="object-contain p-1"
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
