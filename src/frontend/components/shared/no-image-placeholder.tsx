import { ImageOff } from 'lucide-react';

/**
 * Shared placeholder for product cards that have no image.
 * Replaces inline "No Image" text divs across the codebase.
 */
export function NoImagePlaceholder({ className = '' }: { className?: string }) {
  return (
    <div className={`h-full w-full flex flex-col items-center justify-center gap-1.5 text-muted-foreground bg-zinc-50 ${className}`}>
      <ImageOff className="h-6 w-6 text-zinc-300" />
      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">No Image</span>
    </div>
  );
}
export default NoImagePlaceholder;
