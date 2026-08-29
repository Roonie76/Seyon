'use client';

import * as React from 'react';
import { useStorageValue, notifyStorageChanged } from '@/frontend/lib/browser-store';

const NOTICE_KEY = 'seyon_dev_notice_seen';

/**
 * Whether the development notice has been dismissed.
 *
 * Exported because the consent banner has to wait its turn: both are
 * first-visit interruptions, and this modal renders a full-screen backdrop at
 * z-100, so a banner underneath it is not merely ugly — it is unclickable, and
 * consent nobody can give is not consent. Verified by an end-to-end test that
 * failed exactly this way before the banner was sequenced behind it.
 */
export function useDevNoticeAcknowledged(): boolean {
  return useStorageValue(() => localStorage.getItem(NOTICE_KEY) === 'true', true);
}
import { X } from 'lucide-react';
import { useBodyScrollLock } from '@/frontend/lib/overlay';
import { Button } from '@/components/ui/button';

export function DevNoticeModal() {
  // Acknowledgement lives in localStorage. Subscribing keeps the server render
  // and the first client render identical (closed), then reveals the notice
  // without the extra render pass a mount effect would cause.
  const acknowledged = useDevNoticeAcknowledged();
  const isOpen = !acknowledged;

  // A full-screen backdrop that does not stop the page behind it from
  // scrolling: measured at 390x844, scrollY went 0 -> 900 under the notice.
  useBodyScrollLock(isOpen);

  const handleClose = () => {
    try {
      localStorage.setItem(NOTICE_KEY, 'true');
    } catch {
      // Private mode or blocked storage: the notice simply shows again.
    }
    notifyStorageChanged();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm transition-all duration-300 animate-fade-in">
      <div 
        className="relative w-full max-w-md bg-[#FCFAF7] dark:bg-zinc-900 border border-[#F0ECE3] dark:border-zinc-800 rounded-[28px] p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center transition-all duration-300 transform scale-100 animate-scale-in"
        role="dialog"
        aria-modal="true"
      >
        {/* Decorative close button on top right */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header Title with elegant Serif style */}
        <h2 className="font-serif text-2xl sm:text-3xl font-extrabold text-zinc-950 dark:text-white tracking-tight mb-4 pt-3">
          Seyon is in Development
        </h2>

        {/* Message body describing dev notice and placeholders */}
        <p className="text-zinc-650 dark:text-zinc-300 text-sm leading-relaxed mb-6 font-medium">
          Thank you for visiting our early preview. Seyon is currently under active development, and some stores, products, reviews, and checkout experiences are provided for demonstration purposes only.
          <br /><br />
          Orders placed during this preview will not be processed, fulfilled, or shipped.
        </p>

        {/* Call to action button with gold/amber premium gradient */}
        <Button
          onClick={handleClose}
          className="w-full h-11 bg-gradient-to-b from-[#B88F47] to-[#A77F3A] hover:from-[#c29952] hover:to-[#b0873f] text-white font-semibold rounded-full shadow-md active:scale-95 transition-all duration-200 cursor-pointer"
        >
          Acknowledge &amp; Explore
        </Button>
      </div>
    </div>
  );
}

export default DevNoticeModal;
