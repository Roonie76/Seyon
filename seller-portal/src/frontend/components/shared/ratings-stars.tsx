import { Star, StarHalf } from 'lucide-react';

interface RatingsStarsProps {
  rating: number;
  maxStars?: number;
  size?: number;
}

export function RatingsStars({ rating, maxStars = 5, size = 16 }: RatingsStarsProps) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.4 && rating % 1 <= 0.8;
  const emptyStars = maxStars - fullStars - (hasHalf ? 1 : 0);

  return (
    <div className="flex items-center gap-0.5 text-yellow-400">
      {Array.from({ length: fullStars }).map((_, idx) => (
        <Star key={`full-${idx}`} size={size} fill="currentColor" className="text-yellow-400" />
      ))}
      {hasHalf && (
        <div className="relative">
          <StarHalf size={size} fill="currentColor" className="text-yellow-400" />
        </div>
      )}
      {Array.from({ length: emptyStars }).map((_, idx) => (
        <Star key={`empty-${idx}`} size={size} className="text-zinc-300" />
      ))}
    </div>
  );
}
export default RatingsStars;
