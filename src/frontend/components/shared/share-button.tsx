'use client';

import * as React from 'react';
import { Share2, Check } from 'lucide-react';

interface ShareButtonProps {
  title: string;
  /** Absolute or relative URL; relative is resolved against the current origin. */
  url: string;
  text?: string;
  className?: string;
}

/**
 * Native share sheet via the Web Share API (mobile), clipboard fallback (desktop).
 */
export function ShareButton({ title, url, text, className = '' }: ShareButtonProps) {
  const [copied, setCopied] = React.useState(false);

  const handleShare = async () => {
    const absoluteUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;

    if (navigator.share) {
      try {
        await navigator.share({ title, text: text || title, url: absoluteUrl });
        return;
      } catch {
        // User cancelled or share failed; fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Share/copy failed:', err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      title="Share"
      aria-label="Share"
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-800 transition-colors cursor-pointer ${className}`}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-600" /> Link copied!
        </>
      ) : (
        <>
          <Share2 className="h-3.5 w-3.5" /> Share
        </>
      )}
    </button>
  );
}
