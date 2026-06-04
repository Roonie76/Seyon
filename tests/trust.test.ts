import { describe, it, expect } from 'vitest';
import { calculateTrustScore } from '../src/frontend/lib/utils';

describe('calculateTrustScore arithmetic', () => {
  it('assigns New badge to newly registered shops with clean logs', () => {
    const res = calculateTrustScore({
      isVerified: false,
      emailVerified: false,
      hasPhone: false,
      averageRating: 0,
      reviewCount: 0,
      createdAt: new Date(), // Age = 0 days
      openReportsCount: 0,
    });

    // Base 20 + 10 (review buffer) = 30 points.
    // Since age < 15 days, reviews = 0, reports = 0, badge should be 'New'
    expect(res.score).toBe(30);
    expect(res.badge).toBe('New');
    expect(res.color).toContain('text-blue-700');
  });

  it('computes verified status additions correctly', () => {
    const res = calculateTrustScore({
      isVerified: true,
      emailVerified: true,
      hasPhone: true,
      averageRating: 0,
      reviewCount: 0,
      createdAt: new Date(),
      openReportsCount: 0,
    });

    // Base 20 + 30 (verified) + 10 (emailVerified) + 10 (hasPhone) + 10 (review buffer) = 80
    expect(res.score).toBe(80);
    expect(res.badge).toBe('Good');
  });

  it('awards extra points for high reviews volume and rating score', () => {
    const res = calculateTrustScore({
      isVerified: true,
      emailVerified: true,
      hasPhone: true,
      averageRating: 4.8,
      reviewCount: 15,
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // Age = 60 days (2 months)
      openReportsCount: 0,
    });

    // Base 20 + 30 (verified) + 10 (emailVerified) + 10 (hasPhone)
    // + Math.round(4.8 * 6) = 29 points (ratings)
    // + min(10, 15) = 10 points (reviews count)
    // + min(10, 2 months) = 2 points (age)
    // Total = 20+30+10+10+29+10+2 = 111 (clamped to 100)
    expect(res.score).toBe(100);
    expect(res.badge).toBe('Excellent');
  });

  it('deducts trust points upon open abuse reports', () => {
    const res = calculateTrustScore({
      isVerified: false,
      emailVerified: true,
      hasPhone: true,
      averageRating: 4.0,
      reviewCount: 5,
      createdAt: new Date(),
      openReportsCount: 2, // -30 points deduction
    });

    // Base 20 + 10 (emailVerified) + 10 (hasPhone)
    // + 24 (ratings) + 5 (reviews count)
    // = 69 points before reports.
    // 69 - (2 * 15) = 39 points.
    expect(res.score).toBe(39);
    expect(res.badge).toBe('Suspicious');
    expect(res.color).toContain('text-red-700');
  });
});
