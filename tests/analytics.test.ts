import { describe, it, expect, vi, beforeEach } from 'vitest';
import { trackEvent } from '../src/backend/actions/analytics';
import { db } from '@/lib/db';
import { AnalyticsEventType } from '@prisma/client';

// Mock DB client
vi.mock('@/lib/db', () => ({
  db: {
    analytics: {
      create: vi.fn(),
    },
  },
}));

// Mock NextAuth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

describe('Analytics trackEvent Validation and Limits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validShopCuid = 'clj1234560000xx7890abcdef';
  const validProductCuid = 'clj9876540000xx1234abcxyz';

  describe('CUID validation for shopId', () => {
    it('fails if shopId is empty or not a valid CUID', async () => {
      // Empty shopId
      let res = await trackEvent('', AnalyticsEventType.SHOP_VIEW);
      expect(res.error).toBe('Invalid shop ID format');
      expect(db.analytics.create).not.toHaveBeenCalled();

      // Non-CUID string
      res = await trackEvent('not-a-cuid', AnalyticsEventType.SHOP_VIEW);
      expect(res.error).toBe('Invalid shop ID format');

      // UUID string (CUID validator should reject UUIDs)
      res = await trackEvent('123e4567-e89b-12d3-a456-426614174000', AnalyticsEventType.SHOP_VIEW);
      expect(res.error).toBe('Invalid shop ID format');
    });

    it('passes if shopId is a valid CUID format', async () => {
      vi.mocked(db.analytics.create).mockResolvedValueOnce({ id: 'event_1' } as any);

      const res = await trackEvent(validShopCuid, AnalyticsEventType.SHOP_VIEW);

      expect(res.success).toBe(true);
      expect(res.id).toBe('event_1');
      expect(db.analytics.create).toHaveBeenCalledWith({
        data: {
          shopId: validShopCuid,
          productId: null,
          userId: null,
          eventType: AnalyticsEventType.SHOP_VIEW,
        },
      });
    });
  });

  describe('CUID validation for productId', () => {
    it('fails if productId is provided but is not a valid CUID', async () => {
      // Invalid productId format
      const res = await trackEvent(validShopCuid, AnalyticsEventType.PRODUCT_VIEW, 'invalid-prod-id');
      expect(res.error).toBe('Invalid product ID format');
      expect(db.analytics.create).not.toHaveBeenCalled();
    });

    it('passes if productId is not provided', async () => {
      vi.mocked(db.analytics.create).mockResolvedValueOnce({ id: 'event_2' } as any);

      const res = await trackEvent(validShopCuid, AnalyticsEventType.SHOP_VIEW, undefined);

      expect(res.success).toBe(true);
      expect(db.analytics.create).toHaveBeenCalledWith({
        data: {
          shopId: validShopCuid,
          productId: null,
          userId: null,
          eventType: AnalyticsEventType.SHOP_VIEW,
        },
      });
    });

    it('passes if productId is a valid CUID format', async () => {
      vi.mocked(db.analytics.create).mockResolvedValueOnce({ id: 'event_3' } as any);

      const res = await trackEvent(validShopCuid, AnalyticsEventType.PRODUCT_VIEW, validProductCuid);

      expect(res.success).toBe(true);
      expect(db.analytics.create).toHaveBeenCalledWith({
        data: {
          shopId: validShopCuid,
          productId: validProductCuid,
          userId: null,
          eventType: AnalyticsEventType.PRODUCT_VIEW,
        },
      });
    });
  });

  describe('EventType validation limits', () => {
    it('fails if eventType is not a valid AnalyticsEventType', async () => {
      // Cast invalid string to AnalyticsEventType to test runtime validation
      const res = await trackEvent(validShopCuid, 'INVALID_EVENT' as any);
      expect(res.error).toBe('Invalid event type');
      expect(db.analytics.create).not.toHaveBeenCalled();
    });

    it('passes for all valid AnalyticsEventType values', async () => {
      const validTypes = [
        AnalyticsEventType.SHOP_VIEW,
        AnalyticsEventType.PRODUCT_VIEW,
        AnalyticsEventType.WHATSAPP_CLICK,
      ];

      for (const type of validTypes) {
        vi.mocked(db.analytics.create).mockResolvedValueOnce({ id: `event_${type}` } as any);
        const res = await trackEvent(validShopCuid, type, type === AnalyticsEventType.PRODUCT_VIEW ? validProductCuid : undefined);
        expect(res.success).toBe(true);
      }
    });
  });

  describe('Database Error Handling', () => {
    it('returns error message if database insertion fails', async () => {
      vi.mocked(db.analytics.create).mockRejectedValueOnce(new Error('DB Connection Timeout'));

      const res = await trackEvent(validShopCuid, AnalyticsEventType.SHOP_VIEW);

      expect(res.error).toBe('Failed to record click metric');
      expect(res.success).toBeUndefined();
    });
  });
});
