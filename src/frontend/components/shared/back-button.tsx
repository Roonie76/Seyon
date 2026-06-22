'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  fallbackHref: string;
  label?: string;
  className?: string;
}

export function BackButton({ fallbackHref, label = 'Back', className = '' }: BackButtonProps) {
  return (
    <Link
      href={fallbackHref}
      aria-label={label === 'Back' ? 'Go back' : `Go back to ${label}`}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-750 hover:text-zinc-950 hover:border-zinc-300 hover:bg-zinc-50 active:scale-95 transition-all duration-200 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none group shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 ${className}`}
    >
      <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
      {label}
    </Link>
  );
}
