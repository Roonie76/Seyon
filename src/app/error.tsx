'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import * as Sentry from '@sentry/nextjs';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-muted-foreground">
        We hit an unexpected error while loading this page. It&apos;s not you — please try again.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground/60">Error reference: {error.digest}</p>
      )}
      <div className="flex gap-3">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="ghost" asChild>
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
