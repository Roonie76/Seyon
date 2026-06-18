import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        // Variants
        variant === 'default' && "border-transparent bg-primary text-primary-foreground shadow",
        variant === 'secondary' && "border-transparent bg-secondary text-secondary-foreground",
        variant === 'destructive' && "border-transparent bg-red-500/10 text-red-400 border-red-500/20",
        variant === 'outline' && "text-foreground border-border/80",
        variant === 'success' && "border-transparent bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
        variant === 'warning' && "border-transparent bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
        variant === 'info' && "border-transparent bg-sky-500/10 text-sky-400 border-sky-500/20",
        className
      )}
      {...props}
    />
  );
}

export { Badge };
export default Badge;
