'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Star, AlertTriangle, ArrowRight } from 'lucide-react';
import { trackEvent } from '@/actions/analytics';
import { createReview } from '@/actions/reviews';
import { createReport } from '@/actions/reports';

interface WhatsAppButtonProps {
  shopId: string;
  whatsappNumber: string;
  shopName: string;
  productId?: string;
  productName?: string;
  price?: number;
}

export function WhatsAppButton({ shopId, whatsappNumber, shopName, productId, productName, price }: WhatsAppButtonProps) {
  const handleClick = async () => {
    try {
      // Record analytics
      await trackEvent(shopId, 'WHATSAPP_CLICK', productId);
    } catch (error) {
      console.error('Analytics tracking failed:', error);
    }

    // Generate wa.me Link
    let text = `Hi, I found your shop "${shopName}" on Seyon and I'm interested in buying from you!`;
    if (productName && price !== undefined) {
      text = `Hi, I found your product "${productName}" ($${price.toFixed(2)}) at your shop "${shopName}" on Seyon. I would like to purchase it!`;
    }

    const encodedText = encodeURIComponent(text);
    let cleanNumber = whatsappNumber.replace(/[^\d]/g, '');
    if (cleanNumber.length === 10) {
      cleanNumber = `91${cleanNumber}`;
    }
    const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodedText}`;
    
    // Open WhatsApp in new tab
    window.open(whatsappUrl, '_blank');
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full sm:w-auto bg-white border border-[#F0ECE3] hover:border-[#A77F3A]/40 rounded-[20px] py-2.5 px-6 shadow-3xs flex items-center justify-between sm:justify-start gap-4 transition-all duration-300 group/btn cursor-pointer active:scale-[0.98]"
    >
      <div className="flex-1 sm:flex-none text-center sm:text-left select-none">
        <span className="font-serif text-[11px] font-bold text-zinc-950 block leading-tight">Talk to Creator</span>
        <span className="text-[8px] text-zinc-450 font-bold block mt-0.5">on WhatsApp</span>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-zinc-950 shrink-0 transition-transform group-hover/btn:translate-x-0.5 stroke-[2]" />
    </button>
  );
}

interface ReviewModalProps {
  shopId: string;
}

export function ReviewModal({ shopId }: ReviewModalProps) {
  const [rating, setRating] = React.useState(5);
  const [hoverRating, setHoverRating] = React.useState<number | null>(null);
  const [comment, setComment] = React.useState('');
  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    const result = await createReview(shopId, { rating, comment });
    setIsLoading(false);

    if (result.error) {
      setMessage({ type: 'error', text: result.error });
    } else {
      setMessage({ type: 'success', text: 'Thank you for your feedback!' });
      setComment('');
      setTimeout(() => {
        setIsOpen(false);
        setMessage(null);
        window.location.reload(); // Refresh to show new review
      }, 1500);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger>
        <Button variant="outline" size="sm">Leave a Review</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Write Store Review</DialogTitle>
          <DialogDescription>Share your buying experience with other shoppers.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 my-2">
          {message && (
            <div className={`p-3 rounded-md text-sm font-semibold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {message.text}
            </div>
          )}

          {/* Star selector */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-foreground/90">Rating</label>
            <div className="flex items-center gap-1.5 mt-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(null)}
                  className="text-yellow-400 focus:outline-none p-1 cursor-pointer"
                >
                  <Star
                    size={28}
                    fill={(hoverRating !== null ? hoverRating >= star : rating >= star) ? 'currentColor' : 'none'}
                    className="transition-colors duration-100"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Comment text */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-foreground/90">Comment</label>
            <Textarea
              required
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell us about the transaction speed, product description matching, etc."
              className="resize-none"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? 'Submitting...' : 'Submit Review'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ReportModalProps {
  shopId: string;
}

export function ReportModal({ shopId }: ReportModalProps) {
  const [reason, setReason] = React.useState('');
  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    const result = await createReport(shopId, { reason });
    setIsLoading(false);

    if (result.error) {
      setMessage({ type: 'error', text: result.error });
    } else {
      setMessage({ type: 'success', text: 'Storefront has been reported. Admins are reviewing.' });
      setReason('');
      setTimeout(() => {
        setIsOpen(false);
        setMessage(null);
      }, 1500);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger>
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-red-400 gap-1 mt-1">
          <AlertTriangle className="h-3.5 w-3.5" /> Report Shop
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="h-5 w-5" /> Report Storefront
          </DialogTitle>
          <DialogDescription>
            Report fraud, fake listings, scams, or abusive content. Action will be taken by moderators.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 my-2">
          {message && (
            <div className={`p-3 rounded-md text-sm font-semibold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {message.text}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-foreground/90">Reason for Report</label>
            <Textarea
              required
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide context about why this storefront violates platform rules (e.g. fake products, suspicious links, spam comments)..."
              className="resize-none"
            />
          </div>

          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={isLoading} className="w-full">
              {isLoading ? 'Filing Report...' : 'File Official Report'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
