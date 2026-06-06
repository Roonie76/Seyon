import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'whatsapp';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-95 cursor-pointer",
          // Variants
          variant === 'default' && "bg-gradient-to-b from-amber-300 to-amber-500 hover:from-amber-400 hover:to-amber-600 text-black border border-amber-500/30 shadow-md font-semibold transition-all",
          variant === 'destructive' && "bg-red-600 text-white shadow-sm hover:bg-red-500",
          variant === 'outline' && "border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800",
          variant === 'secondary' && "bg-secondary text-secondary-foreground hover:bg-secondary/80",
          variant === 'ghost' && "hover:bg-accent/20 hover:text-accent-foreground text-foreground/80 hover:text-foreground",
          variant === 'link' && "text-primary underline-offset-4 hover:underline",
          variant === 'whatsapp' && "bg-emerald-600 text-white shadow-md hover:bg-emerald-500 shadow-emerald-500/10 font-semibold gap-2",
          // Sizes
          size === 'default' && "h-10 px-4 py-2",
          size === 'sm' && "h-8 rounded-md px-3 text-xs",
          size === 'lg' && "h-12 rounded-md px-8 text-base",
          size === 'icon' && "h-10 w-10",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
export default Button;
