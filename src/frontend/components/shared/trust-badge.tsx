import { calculateTrustScore } from '@/lib/utils';
import { ShieldCheck, ShieldAlert, Award } from 'lucide-react';

interface TrustBadgeProps {
  isVerified: boolean;
  emailVerified: boolean;
  hasPhone: boolean;
  whatsappVerified?: boolean;
  averageRating: number;
  reviewCount: number;
  createdAt: Date;
  openReportsCount: number;
  showScore?: boolean;
}

export function TrustBadge({
  isVerified,
  emailVerified,
  hasPhone,
  whatsappVerified = false,
  averageRating,
  reviewCount,
  createdAt,
  openReportsCount,
  showScore = true,
}: TrustBadgeProps) {
  const { score, badge, color } = calculateTrustScore({
    isVerified,
    emailVerified,
    hasPhone,
    whatsappVerified,
    averageRating,
    reviewCount,
    createdAt,
    openReportsCount,
  });

  return (
    <div className="flex flex-col gap-2 p-4 rounded-lg border border-border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {badge === 'Excellent' || badge === 'Good' ? (
            <Award className="h-5 w-5 text-amber-500" />
          ) : badge === 'Suspicious' ? (
            <ShieldAlert className="h-5 w-5 text-red-600" />
          ) : (
            <ShieldCheck className="h-5 w-5 text-amber-500" />
          )}
          <span className="font-semibold text-foreground">Trust Rating</span>
        </div>
        {badge === 'Excellent' ? (
          <span 
            className="italic text-[15px] font-medium text-[#004225]"
            style={{ fontFamily: 'var(--font-serif-custom), Georgia, serif' }}
          >
            Excellent
          </span>
        ) : (
          <span className={`text-xs px-2.5 py-0.5 rounded-full border font-bold ${color.split(' ')[0] || ''} ${color.split(' ')[1] || ''}`}>
            {badge}
          </span>
        )}
      </div>

      {showScore && (
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-foreground tracking-tight">{score}</span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      )}

      {/* Trust factors summary */}
      <div className="mt-2 text-xs space-y-1 text-muted-foreground">
        <div className="flex justify-between">
          <span>Seller Verification:</span>
          <span className={isVerified ? 'text-emerald-600 font-bold' : 'text-muted-foreground/60'}>
            {isVerified ? 'Verified' : 'Pending'}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Customer Reviews:</span>
          <span className={reviewCount > 0 ? 'text-foreground font-semibold' : 'text-muted-foreground/60'}>
            {reviewCount > 0 ? `${averageRating.toFixed(1)} ★ (${reviewCount})` : 'No reviews'}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Account Verifications:</span>
          <span className="text-foreground font-semibold">
            {emailVerified ? 'Email ' : ''}
            {hasPhone ? 'Phone' : ''}
            {!emailVerified && !hasPhone ? 'None' : ''}
          </span>
        </div>
        <div className="flex justify-between">
          <span>WhatsApp Contact:</span>
          <span className={whatsappVerified ? 'text-emerald-600 font-bold' : 'text-muted-foreground/60'}>
            {whatsappVerified ? 'Verified' : 'Unverified'}
          </span>
        </div>
      </div>
    </div>
  );
}
export default TrustBadge;
