'use client';

import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@/lib/utils';

interface PriceRangeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onValueChange: (value: [number, number]) => void;
  onValueCommit?: (value: [number, number]) => void;
  className?: string;
}

export function PriceRangeSlider({
  min,
  max,
  step = 1,
  value,
  onValueChange,
  onValueCommit,
  className,
}: PriceRangeSliderProps) {
  return (
    <SliderPrimitive.Root
      className={cn(
        'relative flex items-center select-none touch-none w-full h-5',
        className
      )}
      min={min}
      max={max}
      step={step}
      value={value}
      onValueChange={(val) => onValueChange(val as [number, number])}
      onValueCommit={(val) => onValueCommit?.(val as [number, number])}
    >
      <SliderPrimitive.Track className="bg-zinc-250 relative grow rounded-full h-1">
        <SliderPrimitive.Range className="absolute bg-amber-500 rounded-full h-full" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className="block w-4 h-4 bg-white border-2 border-amber-500 rounded-full hover:scale-110 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-transform shadow-md cursor-pointer"
        aria-label="Min price"
      />
      <SliderPrimitive.Thumb
        className="block w-4 h-4 bg-white border-2 border-amber-500 rounded-full hover:scale-110 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-transform shadow-md cursor-pointer"
        aria-label="Max price"
      />
    </SliderPrimitive.Root>
  );
}
