import * as React from 'react';
import { 
  Truck, 
  Zap, 
  RotateCcw, 
  CreditCard, 
  ShieldCheck, 
  Gift, 
  Tag, 
  Package,
  ChevronDown,
  Info
} from 'lucide-react';

export interface ParsedOffer {
  originalText: string;
  cleanText: string;
  emoji?: string;
  iconType: 'truck' | 'zap' | 'return' | 'cod' | 'shield' | 'gift' | 'tag' | 'package';
  colorTheme: 'emerald' | 'amber' | 'sky' | 'indigo' | 'teal' | 'rose' | 'zinc';
}

const defaultDescriptions: Record<string, string> = {
  'free shipping': 'We deliver to all pin codes across India at no extra cost.',
  'free delivery': 'We deliver to all pin codes across India at no extra cost.',
  'premium packaging': 'Every order is packaged with care in our signature luxury presentation box, perfect for gifting.',
  'ships in 48h': 'Your order will be dispatched from our studio within 48 hours, with live tracking provided.',
  'ships in 24h': 'Your order will be dispatched from our studio within 24 hours, with live tracking provided.',
  'same day delivery': 'Orders placed before 12 PM are dispatched the same day for ultra-fast delivery.',
  'cash on delivery': 'Pay securely at your doorstep when your order arrives. No advance payment required.',
  'cod': 'Pay securely at your doorstep when your order arrives. No advance payment required.',
  'easy returns': 'Enjoy peace of mind with our hassle-free 7-day exchange and return policy.',
  '10% off': 'Apply this offer during checkout to save on your order total direct with the seller.'
};

function getDescriptionForOffer(cleanText: string): string {
  const lower = cleanText.toLowerCase();
  for (const [key, desc] of Object.entries(defaultDescriptions)) {
    if (lower.includes(key)) {
      return desc;
    }
  }
  return 'Direct storefront guarantee. Order straight on WhatsApp with no middleman transaction fees.';
}

function extractEmoji(text: string): { emoji?: string; text: string } {
  const trimmed = text.trim();
  try {
    const match = trimmed.match(/^([\p{Extended_Pictographic}\p{Emoji_Presentation}])\s*(.*)$/u);
    if (match) {
      return { emoji: match[1], text: match[2].trim() };
    }
  } catch {
    // Fallback regex for environments where unicode property escape isn't supported
    const fallbackMatch = trimmed.match(/^([\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF])\s*(.*)$/);
    if (fallbackMatch) {
      return { emoji: fallbackMatch[1], text: fallbackMatch[2].trim() };
    }
  }
  return { text: trimmed };
}

function getOfferTheme(text: string): {
  iconType: ParsedOffer['iconType'];
  colorTheme: ParsedOffer['colorTheme'];
} {
  const lower = text.toLowerCase();
  
  if (lower.includes('free shipping') || lower.includes('free delivery') || lower.includes('free ship') || lower.includes('no shipping fee')) {
    return { iconType: 'truck', colorTheme: 'emerald' };
  }
  
  if (lower.includes('24h') || lower.includes('24 hour') || lower.includes('same day') || lower.includes('fast ship') || lower.includes('ships in') || lower.includes('ships within') || lower.includes('dispatch')) {
    return { iconType: 'zap', colorTheme: 'amber' };
  }
  
  if (lower.includes('cod') || lower.includes('cash on delivery') || lower.includes('pay on delivery') || lower.includes('cash') || lower.includes('pay at door')) {
    return { iconType: 'cod', colorTheme: 'sky' };
  }
  
  if (lower.includes('return') || lower.includes('refund') || lower.includes('replace') || lower.includes('exchange') || lower.includes('days easy')) {
    return { iconType: 'return', colorTheme: 'indigo' };
  }
  
  if (lower.includes('guarantee') || lower.includes('warranty') || lower.includes('secure') || lower.includes('authentic') || lower.includes('original') || lower.includes('safe') || lower.includes('protect')) {
    return { iconType: 'shield', colorTheme: 'teal' };
  }
  
  if (lower.includes('gift') || lower.includes('freebie') || lower.includes('free gift')) {
    return { iconType: 'gift', colorTheme: 'rose' };
  }
  
  if (lower.includes('discount') || lower.includes('off') || lower.includes('sale') || lower.includes('coupon') || lower.includes('%')) {
    return { iconType: 'tag', colorTheme: 'rose' };
  }
  
  return { iconType: 'package', colorTheme: 'zinc' };
}

export function parseDeliveryNote(note: string | null | undefined): ParsedOffer[] {
  if (!note) return [];
  
  // Split by semicolon, bullet, or pipe
  const items = note.split(/[;·|]+/).map(item => item.trim()).filter(Boolean);
  
  return items.map(item => {
    const { emoji, text } = extractEmoji(item);
    const { iconType, colorTheme } = getOfferTheme(text);
    return {
      originalText: item,
      cleanText: text,
      emoji,
      iconType,
      colorTheme
    };
  });
}

const themeStyles = {
  emerald: {
    bg: 'bg-white border-emerald-200 text-emerald-950 dark:bg-emerald-950/20 dark:border-emerald-800/30 dark:text-emerald-300',
    iconBg: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400',
  },
  amber: {
    bg: 'bg-amber-50/80 border-amber-200/80 text-amber-800 dark:bg-amber-950/20 dark:border-amber-800/30 dark:text-amber-300',
    iconBg: 'bg-amber-100/80 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  },
  sky: {
    bg: 'bg-sky-50/80 border-sky-200/80 text-sky-800 dark:bg-sky-950/20 dark:border-sky-800/30 dark:text-sky-300',
    iconBg: 'bg-sky-100/80 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400',
  },
  indigo: {
    bg: 'bg-indigo-50/80 border-indigo-200/80 text-indigo-800 dark:bg-indigo-950/20 dark:border-indigo-800/30 dark:text-indigo-300',
    iconBg: 'bg-indigo-100/80 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400',
  },
  teal: {
    bg: 'bg-teal-50/80 border-teal-200/80 text-teal-800 dark:bg-teal-950/20 dark:border-teal-800/30 dark:text-teal-300',
    iconBg: 'bg-teal-100/80 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400',
  },
  rose: {
    bg: 'bg-rose-50/80 border-rose-200/80 text-rose-800 dark:bg-rose-950/20 dark:border-rose-800/30 dark:text-rose-300',
    iconBg: 'bg-rose-100/80 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400',
  },
  zinc: {
    bg: 'bg-zinc-50/80 border-zinc-200/80 text-zinc-700 dark:bg-zinc-900/20 dark:border-zinc-800/30 dark:text-zinc-300',
    iconBg: 'bg-zinc-100/80 text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400',
  },
};

function getIconComponent(type: ParsedOffer['iconType'], className?: string) {
  const finalClass = className || 'h-4 w-4';
  switch (type) {
    case 'truck': return <Truck className={finalClass} />;
    case 'zap': return <Zap className={finalClass} />;
    case 'return': return <RotateCcw className={finalClass} />;
    case 'cod': return <CreditCard className={finalClass} />;
    case 'shield': return <ShieldCheck className={finalClass} />;
    case 'gift': return <Gift className={finalClass} />;
    case 'tag': return <Tag className={finalClass} />;
    default: return <Package className={finalClass} />;
  }
}

/**
 * Renders a stacked list of offers with detailed left-aligned badges for the Product Details Sidebar.
 */
export function DeliveryOffersList({ 
  deliveryNote, 
  className = '' 
}: { 
  deliveryNote: string | null | undefined; 
  className?: string;
}) {
  const offers = parseDeliveryNote(deliveryNote);

  return (
    <div className={`flex flex-col gap-3 mb-6 ${className}`}>
      {/* 1. Custom Store Offers Accordion items */}
      {offers.map((offer, idx) => {
        const description = getDescriptionForOffer(offer.cleanText);
        return (
          <details 
            key={idx} 
            className="group border border-zinc-200 bg-zinc-50/50 rounded-xl overflow-hidden transition-all duration-300 open:border-amber-500/30 open:bg-amber-50/50"
          >
            <summary className="flex items-center gap-3 p-3.5 cursor-pointer list-none [&::-webkit-details-marker]:hidden select-none">
              <div className="h-8 w-8 rounded-full border border-amber-500/15 bg-amber-500/5 flex items-center justify-center text-amber-600 shrink-0">
                {offer.emoji ? (
                  <span className="text-base select-none leading-none mt-0.5">{offer.emoji}</span>
                ) : (
                  getIconComponent(offer.iconType, 'h-4 w-4')
                )}
              </div>
              <span className="font-bold text-foreground text-sm flex-1 leading-snug">{offer.cleanText}</span>
              <ChevronDown className="h-4 w-4 text-amber-500 transition-transform duration-300 group-open:rotate-180 shrink-0" />
            </summary>
            <div className="px-4 pb-4 pl-[52px] text-xs text-muted-foreground leading-relaxed animate-slide-down">
              {description}
            </div>
          </details>
        );
      })}

      {/* 2. Standard "How purchasing works" Accordion item at the bottom */}
      <details className="group border border-zinc-200 bg-zinc-50/50 rounded-xl overflow-hidden transition-all duration-300 open:border-amber-500/30 open:bg-amber-50/50">
        <summary className="flex items-center gap-3 p-3.5 cursor-pointer list-none [&::-webkit-details-marker]:hidden select-none">
          <div className="h-8 w-8 rounded-full border border-amber-500/15 bg-amber-500/5 flex items-center justify-center text-amber-600 shrink-0">
            <Info className="h-4 w-4" />
          </div>
          <span className="font-bold text-foreground text-sm flex-1 leading-snug">How purchasing works</span>
          <ChevronDown className="h-4 w-4 text-amber-500 transition-transform duration-300 group-open:rotate-180 shrink-0" />
        </summary>
        <div className="px-4 pb-4 pl-[52px] text-xs text-muted-foreground leading-relaxed animate-slide-down">
          Seyon connects you directly to the seller. Clicking the button below opens WhatsApp with a prefilled purchase inquiry message.
        </div>
      </details>
    </div>
  );
}

/**
 * Renders a row of horizontal offer badge pills, useful for the Storefront Header and Settings Previews.
 */
export function DeliveryOffersRow({ 
  deliveryNote, 
  className = '',
  isPreview = false
}: { 
  deliveryNote: string | null | undefined; 
  className?: string;
  isPreview?: boolean;
}) {
  const offers = parseDeliveryNote(deliveryNote);
  if (offers.length === 0) {
    if (isPreview) {
      return (
        <p className="text-xs text-muted-foreground/60 italic mt-1 pl-1">
          Type above to see a preview of your offers (e.g. Free shipping; Ships in 24h)
        </p>
      );
    }
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {offers.map((offer, idx) => {
        const style = themeStyles[offer.colorTheme];
        return (
          <div 
            key={idx}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold shadow-sm leading-none ${style.bg}`}
          >
            {offer.emoji ? (
              <span className="text-sm select-none leading-none">{offer.emoji}</span>
            ) : (
              getIconComponent(offer.iconType, 'h-3.5 w-3.5 shrink-0')
            )}
            <span>{offer.cleanText}</span>
          </div>
        );
      })}
    </div>
  );
}
