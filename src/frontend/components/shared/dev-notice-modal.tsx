'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DevNoticeModal() {
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    // Check if the user has already acknowledged the notice
    const hasSeenNotice = localStorage.getItem('seyon_dev_notice_seen');
    if (!hasSeenNotice) {
      setIsOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem('seyon_dev_notice_seen', 'true');
    setIsOpen(false);
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
        <p className="text-zinc-600 dark:text-zinc-350 text-sm leading-relaxed mb-6 font-medium">
          Welcome! Seyon is currently in active development. All stores, products, reviews, and transaction checkouts on this platform are placeholder fillers for demonstration purposes. Orders will not be processed or shipped.
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
