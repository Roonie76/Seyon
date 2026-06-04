import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createReview } from '../src/backend/actions/reviews';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

// Mock DB client
vi.mock('@/lib/db', () => ({
  db: {
    shop: {
      findUnique: vi.fn(),
    },
    review: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// Mock NextAuth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

// Mock Next Cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Reviews Server Actions - Submission and Spam Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createReview Authorization and Existence Checks', () => {
    it('fails if the user is not authenticated', async () => {
      vi.mocked(auth as any).mockResolvedValue(null);

      const res = await createReview('shop_1', { rating: 5, comment: 'Nice!' });

      expect(res.error).toBe('You must be logged in to leave a review');
      expect(res.success).toBeUndefined();
    });

    it('fails if user ID is missing from session', async () => {
      vi.mocked(auth as any).mockResolvedValue({ user: {} } as any);

      const res = await createReview('shop_1', { rating: 5, comment: 'Nice!' });

      expect(res.error).toBe('User ID not found in session');
    });

    it('fails if the target shop does not exist', async () => {
      vi.mocked(auth as any).mockResolvedValue({ user: { id: 'buyer_1' } } as any);
      vi.mocked(db.shop.findUnique).mockResolvedValue(null);

      const res = await createReview('non_existent_shop', { rating: 5, comment: 'Nice!' });

      expect(res.error).toBe('Shop not found');
      expect(db.shop.findUnique).toHaveBeenCalledWith({ where: { id: 'non_existent_shop' } });
    });
  });

  describe('createReview Spam Prevention Logic', () => {
    it('prevents a shop owner from reviewing their own shop', async () => {
      vi.mocked(auth as any).mockResolvedValue({ user: { id: 'seller_1' } } as any);
      vi.mocked(db.shop.findUnique).mockResolvedValue({
        id: 'shop_1',
        ownerId: 'seller_1',
        slug: 'seller-shop',
      } as any);

      const res = await createReview('shop_1', { rating: 5, comment: 'I am the best!' });

      expect(res.error).toBe('You cannot leave a review for your own shop');
    });

    it('validates review ratings (must be integer between 1 and 5)', async () => {
      vi.mocked(auth as any).mockResolvedValue({ user: { id: 'buyer_1' } } as any);
      vi.mocked(db.shop.findUnique).mockResolvedValue({
        id: 'shop_1',
        ownerId: 'seller_1',
        slug: 'seller-shop',
      } as any);

      // Rating too low
      let res = await createReview('shop_1', { rating: 0, comment: 'Good shop' });
      expect(res.error).toBe('Rating must be between 1 and 5');

      // Rating too high
      res = await createReview('shop_1', { rating: 6, comment: 'Good shop' });
      expect(res.error).toBe('Rating must be between 1 and 5');

      // Non-integer rating
      res = await createReview('shop_1', { rating: 4.5, comment: 'Good shop' });
      expect(res.error).toBe('Invalid input: expected int, received number');
    });

    it('validates comment length constraints', async () => {
      vi.mocked(auth as any).mockResolvedValue({ user: { id: 'buyer_1' } } as any);
      vi.mocked(db.shop.findUnique).mockResolvedValue({
        id: 'shop_1',
        ownerId: 'seller_1',
        slug: 'seller-shop',
      } as any);

      // Comment too short
      let res = await createReview('shop_1', { rating: 5, comment: 'No' });
      expect(res.error).toBe('Comment must be at least 3 characters');

      // Comment too long
      const longComment = 'a'.repeat(1001);
      res = await createReview('shop_1', { rating: 5, comment: longComment });
      expect(res.error).toBe('Comment cannot exceed 1000 characters');
    });

    it('prevents multiple reviews from the same buyer on a single shop', async () => {
      vi.mocked(auth as any).mockResolvedValue({ user: { id: 'buyer_1' } } as any);
      vi.mocked(db.shop.findUnique).mockResolvedValue({
        id: 'shop_1',
        ownerId: 'seller_1',
        slug: 'seller-shop',
      } as any);
      
      // Mock existing review found
      vi.mocked(db.review.findUnique).mockResolvedValue({
        id: 'rev_1',
        shopId: 'shop_1',
        userId: 'buyer_1',
        rating: 4,
        comment: 'Already commented',
      } as any);

      const res = await createReview('shop_1', { rating: 5, comment: 'Trying to comment again' });

      expect(res.error).toBe('You have already submitted a review for this storefront');
      expect(db.review.findUnique).toHaveBeenCalledWith({
        where: {
          shopId_userId: {
            shopId: 'shop_1',
            userId: 'buyer_1',
          },
        },
      });
    });
  });

  describe('createReview Success Path', () => {
    it('creates the review and revalidates paths', async () => {
      vi.mocked(auth as any).mockResolvedValue({ user: { id: 'buyer_1' } } as any);
      vi.mocked(db.shop.findUnique).mockResolvedValue({
        id: 'shop_1',
        ownerId: 'seller_1',
        slug: 'seller-shop',
      } as any);
      vi.mocked(db.review.findUnique).mockResolvedValue(null); // No prior review

      const mockCreatedReview = {
        id: 'new_rev_id',
        shopId: 'shop_1',
        userId: 'buyer_1',
        rating: 5,
        comment: 'Absolutely amazing storefront!',
        user: { name: 'Buyer User', image: '/img.jpg' },
      };
      vi.mocked(db.review.create).mockResolvedValue(mockCreatedReview as any);

      const res = await createReview('shop_1', {
        rating: 5,
        comment: 'Absolutely amazing storefront!',
      });

      expect(res.success).toBe(true);
      expect(res.review).toEqual(mockCreatedReview);
      expect(db.review.create).toHaveBeenCalledWith({
        data: {
          shopId: 'shop_1',
          userId: 'buyer_1',
          rating: 5,
          comment: 'Absolutely amazing storefront!',
        },
        include: {
          user: {
            select: { name: true, image: true },
          },
        },
      });

      expect(revalidatePath).toHaveBeenCalledWith('/store/seller-shop');
      expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('Average Rating Calculation Math Logic', () => {
    // Utility local implementation matching the storefront page
    const calculateAverageRating = (reviews: { rating: number }[]) => {
      const reviewCount = reviews.length;
      return reviewCount > 0
        ? reviews.reduce((acc, rev) => acc + rev.rating, 0) / reviewCount
        : 0;
    };

    it('returns 0 when there are no reviews', () => {
      const reviews: { rating: number }[] = [];
      expect(calculateAverageRating(reviews)).toBe(0);
    });

    it('returns the exact rating when there is a single review', () => {
      const reviews = [{ rating: 5 }];
      expect(calculateAverageRating(reviews)).toBe(5);
    });

    it('returns the mathematical average for multiple integer ratings', () => {
      const reviews = [{ rating: 5 }, { rating: 4 }, { rating: 3 }]; // Sum: 12, Count: 3
      expect(calculateAverageRating(reviews)).toBe(4);
    });

    it('returns correct decimal average rating', () => {
      const reviews = [{ rating: 5 }, { rating: 4 }, { rating: 4 }]; // Sum: 13, Count: 3 => 4.333333333333333
      expect(calculateAverageRating(reviews)).toBeCloseTo(4.333, 3);
    });

    it('handles a diverse rating set correctly', () => {
      const reviews = [
        { rating: 1 },
        { rating: 2 },
        { rating: 3 },
        { rating: 4 },
        { rating: 5 },
        { rating: 5 }
      ]; // Sum: 20, Count: 6 => 3.333...
      expect(calculateAverageRating(reviews)).toBeCloseTo(3.333, 3);
    });
  });
});
