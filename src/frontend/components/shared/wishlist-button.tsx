'use client';

import { useState } from 'react';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toggleWishlistItem } from '@/actions/wishlist';
import { track } from '@/frontend/lib/events';
import { cn } from '@/lib/utils';

interface WishlistButtonProps {
  productId: string;
  initialIsWishlisted: boolean;
  className?: string;
  variant?: 'icon' | 'default' | 'minimal';
}

export function WishlistButton({
  productId,
  initialIsWishlisted,
  className,
  variant = 'icon',
}: WishlistButtonProps) {
  const [isWishlisted, setIsWishlisted] = useState(initialIsWishlisted);
  const [loading, setLoading] = useState(false);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (loading) return;
    setLoading(true);

    try {
      const res = await toggleWishlistItem(productId);
      if (res.success) track('product_wishlisted', { productId, added: Boolean(res.added) });
      if (res.success) {
        setIsWishlisted(!!res.added);
      } else if (res.error && res.error.includes('Unauthorized')) {
        // Redirect to login page if unauthenticated
        const currentPath = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/marketplace';
        window.location.href = `/login?callbackUrl=${encodeURIComponent(currentPath)}`;
      } else {
        console.error('Error toggling wishlist:', res.error);
      }
    } catch (error) {
      console.error('Failed to toggle wishlist item:', error);
    } finally {
      setLoading(false);
    }
  };

  if (variant === 'default') {
    return (
      <Button
        onClick={handleToggle}
        disabled={loading}
        variant="outline"
        className={cn(
          "gap-2 font-semibold h-11 border-zinc-200 transition-all duration-300",
          isWishlisted ? "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100" : "hover:bg-zinc-50 text-zinc-700",
          className
        )}
      >
        <Heart className={cn("h-5 w-5", isWishlisted && "fill-rose-500 text-rose-500")} />
        {isWishlisted ? 'Saved to Wishlist' : 'Add to Wishlist'}
      </Button>
    );
  }

  if (variant === 'minimal') {
    return (
      <button
        onClick={handleToggle}
        disabled={loading}
        className={cn(
          "transition-all duration-300 text-zinc-400 hover:text-rose-500 focus:outline-none",
          isWishlisted && "text-rose-500",
          className
        )}
        title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
      >
        <Heart className={cn("h-[18px] w-[18px] transition-transform duration-300 active:scale-125", isWishlisted && "fill-rose-500 text-rose-500")} strokeWidth={1.5} />
      </button>
    );
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={cn(
        "h-8 w-8 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm border",
        isWishlisted 
          ? "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100" 
          : "bg-white/80 backdrop-blur-sm border-zinc-200 text-zinc-500 hover:bg-white hover:text-rose-500",
        className
      )}
      title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
    >
      <Heart className={cn("h-4 w-4 transition-transform duration-300 active:scale-125", isWishlisted && "fill-rose-500 text-rose-500")} />
    </button>
  );
}
