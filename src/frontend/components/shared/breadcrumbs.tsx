'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  return (
    <nav 
      aria-label="Breadcrumb" 
      className={`flex items-center flex-wrap gap-1.5 text-xs font-semibold text-zinc-500 select-none ${className}`}
    >
      <Link 
        href="/marketplace" 
        className="flex items-center gap-1 hover:text-amber-600 transition-colors duration-250 cursor-pointer"
      >
        <Home className="h-3.5 w-3.5" />
        <span>Marketplace</span>
      </Link>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        
        return (
          <React.Fragment key={index}>
            <ChevronRight className="h-3 w-3 text-zinc-350 shrink-0" />
            {isLast || !item.href ? (
              <span className="text-zinc-800 font-bold truncate max-w-[150px] sm:max-w-[300px]">
                {item.label}
              </span>
            ) : (
              <Link 
                href={item.href}
                className="hover:text-amber-605 transition-colors duration-250 hover:underline cursor-pointer truncate max-w-[150px] sm:max-w-[300px]"
              >
                {item.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
