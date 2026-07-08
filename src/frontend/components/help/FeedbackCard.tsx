'use client';

import * as React from 'react';
import { ThumbsUp, ThumbsDown, CheckCircle } from 'lucide-react';

export function FeedbackCard() {
  const [feedback, setFeedback] = React.useState<'yes' | 'no' | null>(null);

  if (feedback !== null) {
    return (
      <div className="rounded-[20px] border border-[#ECE5D9] bg-[#FFFEFC] p-6 text-center flex flex-col items-center gap-2 shadow-[0_1px_3px_rgba(0,0,0,0.01)] animate-fade-in font-sans">
        <CheckCircle className="h-6 w-6 text-[#B88A2E] stroke-[1.5]" />
        <h4 className="text-sm font-bold text-[#1A1A18] font-serif">Thank you for your feedback!</h4>
        <p className="text-xs text-[#6F6A63]">Your inputs help us improve our marketplace help guides.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[20px] border border-[#ECE5D9] bg-[#FFFEFC] p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-[0_1px_3px_rgba(0,0,0,0.01)] font-sans">
      <div>
        <h4 className="text-sm font-bold text-[#1A1A18] font-serif">Was this article helpful?</h4>
        <p className="text-xs text-[#6F6A63] mt-0.5 font-sans">Help us make our guides better for the community.</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setFeedback('yes')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#ECE5D9] hover:border-[#D9BC82] hover:bg-[#FAF8F4] text-[#6F6A63] hover:text-[#B88A2E] text-xs font-semibold transition-all duration-250 cursor-pointer active:scale-98"
        >
          <ThumbsUp className="h-3.5 w-3.5 stroke-[1.5]" />
          Yes
        </button>
        <button
          onClick={() => setFeedback('no')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#ECE5D9] hover:border-[#D9BC82] hover:bg-[#FAF8F4] text-[#6F6A63] hover:text-[#1A1A18] text-xs font-semibold transition-all duration-250 cursor-pointer active:scale-98"
        >
          <ThumbsDown className="h-3.5 w-3.5 stroke-[1.5]" />
          No
        </button>
      </div>
    </div>
  );
}
