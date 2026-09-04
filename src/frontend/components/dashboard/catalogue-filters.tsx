'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import { ProductStatus } from '@prisma/client';

/**
 * Finding one listing in a catalogue.
 *
 * The seller's own product table had no search, no filter and no paging, so a
 * seller with a few hundred listings had exactly one way to find last season's
 * saris: scroll. That is also why bulk archiving was never used — you cannot
 * select what you cannot get to.
 *
 * The state lives in the URL rather than in this component. It costs a
 * navigation, and it buys three things worth more than the navigation: the
 * back button works, "my drafts" is a bookmarkable address, and the server does
 * the filtering, so a large catalogue never reaches the browser at all.
 */

const STATUS_TABS: { value: ProductStatus | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: ProductStatus.ACTIVE, label: 'Live' },
  { value: ProductStatus.DRAFT, label: 'Drafts' },
  { value: ProductStatus.ARCHIVED, label: 'Archived' },
];

export function CatalogueFilters({
  query,
  status,
  total,
}: {
  query: string;
  status: ProductStatus | null;
  total: number;
}) {
  const router = useRouter();

  /**
   * The input is keyed on the URL's search term.
   *
   * Typing has to stay local — a controlled-by-the-URL input would navigate on
   * every keystroke — but the box also has to follow when the seller navigates
   * some other way: the back button, or a status tab. Remounting on a changed
   * `query` does both, without an effect that writes state during render and
   * without a second source of truth to keep in step.
   */
  const [term, setTerm] = React.useState(query);

  function hrefFor(nextQuery: string, nextStatus: ProductStatus | null) {
    const params = new URLSearchParams();
    if (nextQuery.trim()) params.set('q', nextQuery.trim());
    if (nextStatus) params.set('status', nextStatus);
    const qs = params.toString();
    return `/dashboard/products${qs ? `?${qs}` : ''}`;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // Always back to page one: staying on page 7 of a new, shorter result set
    // shows an empty table and looks like the search found nothing.
    router.push(hrefFor(term, status));
  }

  const filtering = Boolean(query || status);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((tab) => {
          const active = tab.value === status;
          return (
            <Button
              key={tab.label}
              size="sm"
              variant={active ? 'default' : 'outline'}
              onClick={() => router.push(hrefFor(term, tab.value))}
              data-testid={`catalogue-tab-${tab.label.toLowerCase()}`}
            >
              {tab.label}
            </Button>
          );
        })}

        <form onSubmit={submit} className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search your products"
              aria-label="Search your products by title"
              data-testid="catalogue-search"
              className="h-9 w-56 pl-8"
            />
          </div>
          <Button type="submit" size="sm" variant="outline">
            Search
          </Button>
          {filtering ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => router.push('/dashboard/products')}
              data-testid="catalogue-clear"
            >
              <X size={13} className="mr-1" /> Clear
            </Button>
          ) : null}
        </form>
      </div>

      {/*
        Said plainly, because an empty table under an active filter reads as
        "you have no products" — which is alarming, and wrong.
      */}
      {filtering ? (
        <p className="text-xs text-muted-foreground" data-testid="catalogue-result-count">
          {total} product{total === 1 ? '' : 's'}
          {query ? ` matching “${query}”` : ''}
          {status ? ` in ${status.toLowerCase()}` : ''}.
        </p>
      ) : null}
    </div>
  );
}
