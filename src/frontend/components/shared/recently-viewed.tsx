'use client';

import * as React from 'react';
import Link from 'next/link';
import { SafeImage as Image } from '@/components/shared/safe-image';
import { History } from 'lucide-react';

const STORAGE_KEY = 'seyon_recently_viewed';
const MAX_ITEMS = 8;

export interface RecentItem {
  id: string;
  title: string;
  price: number;
  shopSlug: string;
  productSlug: string;
  image?: string;
}

function readRecent(): RecentItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Invisible: drop on a product page to record the visit. */
export function RecordRecentlyViewed({ item }: { item: RecentItem }) {
  React.useEffect(() => {
    try {
      const existing = readRecent().filter((r) => r.id !== item.id);
      existing.unshift(item);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.slice(0, MAX_ITEMS)));
    } catch {
      // Private mode / storage full — feature silently degrades
    }
  }, [item]);

  return null;
}

/** Horizontal strip of the buyer's recent products. Renders nothing when empty. */
export function RecentlyViewedStrip({ excludeId }: { excludeId?: string }) {
  const [items, setItems] = React.useState<RecentItem[]>([]);

  React.useEffect(() => {
    requestAnimationFrame(() => {
      setItems(readRecent().filter((r) => r.id !== excludeId));
    });
  }, [excludeId]);

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      setItems([]);
    } catch {
      // Degrades silently
    }
  };

  if (items.length === 0) return null;

  return (
    <section aria-label="Recently viewed products" className="mt-12">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
          <History className="h-4 w-4 text-amber-600" /> Recently viewed
        </h2>
        <button
          onClick={handleClear}
          className="text-xs font-semibold text-amber-650 hover:text-amber-700 transition-colors uppercase tracking-wider cursor-pointer"
        >
          Clear All
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/store/${item.shopSlug}/${item.productSlug}`}
            className="shrink-0 w-36 snap-start rounded-lg border border-zinc-200 bg-card overflow-hidden hover:border-amber-400 transition-colors"
          >
            <div className="relative aspect-square bg-zinc-100">
              {item.image ? (
                <Image src={item.image} alt={item.title} fill className="object-cover" sizes="144px" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-muted-foreground text-[10px]">No image</div>
              )}
            </div>
            <div className="p-2">
              <p className="text-xs font-semibold text-foreground line-clamp-1">{item.title}</p>
              <p className="text-xs font-bold text-amber-700 mt-0.5">₹{item.price.toFixed(2)}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
