import * as React from 'react';
import { 
  Truck, 
  Zap, 
  RotateCcw, 
  CreditCard, 
  ShieldCheck, 
  Gift, 
  Tag, 
  Package 
} from 'lucide-react';

export interface ParsedOffer {
  originalText: string;
  cleanText: string;
  emoji?: string;
  iconType: 'truck' | 'zap' | 'return' | 'cod' | 'shield' | 'gift' | 'tag' | 'package';
  colorTheme: 'emerald' | 'amber' | 'sky' | 'indigo' | 'teal' | 'rose' | 'zinc';
}

function extractEmoji(text: string): { emoji?: string; text: string } {
  const trimmed = text.trim();
  try {
    const match = trimmed.match(/^([\p{Extended_Pictographic}\p{Emoji_Presentation}])\s*(.*)$/u);
    if (match) {
      return { emoji: match[1], text: match[2].trim() };
    }
  } catch (e) {
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
  if (offers.length === 0) return null;

  return (
    <div className={`flex flex-col gap-2.5 mb-6 ${className}`}>
      <span className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Store Offers & Delivery Notes</span>
      <div className="flex flex-col gap-2">
        {offers.map((offer, idx) => {
          const style = themeStyles[offer.colorTheme];
          return (
            <div 
              key={idx}
              className={`flex items-center gap-3 p-3 rounded-lg border text-xs font-semibold leading-snug transition-transform duration-200 hover:scale-[1.01] ${style.bg}`}
            >
              <div className={`h-8 w-8 flex items-center justify-center rounded-full shrink-0 ${style.iconBg}`}>
                {offer.emoji ? (
                  <span className="text-base select-none leading-none mt-0.5">{offer.emoji}</span>
                ) : (
                  getIconComponent(offer.iconType, 'h-4 w-4')
                )}
              </div>
              <span className="flex-1">{offer.cleanText}</span>
            </div>
          );
        })}
      </div>
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
