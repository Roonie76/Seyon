import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TrustScoreParams {
  isVerified: boolean;
  emailVerified: boolean;
  hasPhone: boolean;
  whatsappVerified?: boolean;
  averageRating: number;
  reviewCount: number;
  createdAt: Date;
  openReportsCount: number;
}

/**
 * Calculates a store's Trust Score out of 100 based on verification, reviews, age, and reports.
 */
export function calculateTrustScore(params: TrustScoreParams): {
  score: number;
  badge: 'Excellent' | 'Good' | 'Average' | 'New' | 'Suspicious';
  color: string;
} {
  let score = 20; // Base score for setup

  // 1. Verification status (Max +30)
  if (params.isVerified) {
    score += 30;
  }

  // 2. Email and Phone configurations (Max +20)
  if (params.emailVerified) score += 10;
  if (params.hasPhone) score += 10;
  if (params.whatsappVerified) score += 10;

  // 3. Ratings (Max +30)
  // If no reviews, we don't penalize, but don't add rating points
  if (params.reviewCount > 0) {
    score += Math.round(params.averageRating * 6); // 5 stars = 30 points, 4 stars = 24 points
  } else {
    score += 10; // Default buffer for new shops with clean records
  }

  // 4. Review volume (Max +10)
  score += Math.min(10, params.reviewCount);

  // 5. Store Age (Max +10)
  const ageInMs = Date.now() - new Date(params.createdAt).getTime();
  const ageInDays = Math.floor(ageInMs / (1000 * 60 * 60 * 24));
  const ageInMonths = Math.floor(ageInDays / 30);
  score += Math.min(10, ageInMonths);

  // 6. Deductions from active reports
  score -= params.openReportsCount * 15;

  // Clamp score between 0 and 100
  score = Math.max(0, Math.min(100, score));

  // Determine badge and color code
  let badge: 'Excellent' | 'Good' | 'Average' | 'New' | 'Suspicious' = 'Average';
  let color = 'text-amber-700 bg-amber-50 border-amber-200';

  if (score >= 85) {
    badge = 'Excellent';
    color = 'text-emerald-700 bg-emerald-50 border-emerald-200';
  } else if (score >= 65) {
    badge = 'Good';
    color = 'text-teal-700 bg-teal-50 border-teal-200';
  } else if (ageInDays < 15 && params.reviewCount === 0 && params.openReportsCount === 0) {
    badge = 'New';
    color = 'text-blue-700 bg-blue-50 border-blue-200';
  } else if (score >= 40) {
    badge = 'Average';
    color = 'text-amber-700 bg-amber-50 border-amber-200';
  } else {
    badge = 'Suspicious';
    color = 'text-red-700 bg-red-50 border-red-200';
  }

  return { score, badge, color };
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price);
}
