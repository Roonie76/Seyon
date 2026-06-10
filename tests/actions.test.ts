import { describe, it, expect, vi, beforeEach } from 'vitest';
import { _clearRateLimitStore } from '../src/backend/lib/rate-limit';
import { createShop, updateShop } from '../src/backend/actions/shops';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { Role } from '@prisma/client';
import { revalidatePath } from 'next/cache';

// Mock DB client
vi.mock('@/lib/db', () => {
  const mockDb = {
    shop: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb(mockDb)),
  };
  return { db: mockDb };
});

// Mock NextAuth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

// Mock Next Cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

describe('Shops Server Actions - Onboarding and Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _clearRateLimitStore();
  });

  describe('createShop', () => {
    it('fails if the user is not authenticated', async () => {
      vi.mocked(auth as any).mockResolvedValue(null);

      const res = await createShop({
        name: 'My Store',
        slug: 'my-store',
        whatsapp: '+1234567890',
      });

      expect(res.error).toBe('You must be logged in to create a shop');
      expect(res.success).toBeUndefined();
    });

    it('fails if the user already owns a shop', async () => {
      vi.mocked(auth as any).mockResolvedValue({
        user: { id: 'user_1', role: 'USER' },
        expires: '',
      });
      vi.mocked(db.shop.findUnique).mockResolvedValueOnce({
        id: 'shop_1',
        ownerId: 'user_1',
        name: 'Existing Shop',
        slug: 'existing',
      } as any);

      const res = await createShop({
        name: 'My New Store',
        slug: 'new-store',
        whatsapp: '+1234567890',
      });

      expect(res.error).toBe('You already own a storefront on this platform');
      expect(db.shop.findUnique).toHaveBeenCalledWith({
        where: { ownerId: 'user_1' },
      });
    });

    it('fails with invalid validation parameters', async () => {
      vi.mocked(auth as any).mockResolvedValue({
        user: { id: 'user_1', role: 'USER' },
        expires: '',
      });
      vi.mocked(db.shop.findUnique).mockResolvedValueOnce(null); // No existing shop

      // Invalid slug containing special character, invalid phone format
      const res = await createShop({
        name: 'A', // Too short (min 2)
        slug: 'invalid_slug!',
        whatsapp: 'bad_number',
      });

      expect(res.error).toBeDefined();
      expect(res.success).toBeUndefined();
    });

    it('fails if the shop slug is already taken', async () => {
      vi.mocked(auth as any).mockResolvedValue({
        user: { id: 'user_1', role: 'USER' },
        expires: '',
      });
      // First call is for checking existing shop owned by user (returns null)
      vi.mocked(db.shop.findUnique).mockResolvedValueOnce(null);
      // Second call is for verifying slug uniqueness (returns existing shop)
      vi.mocked(db.shop.findUnique).mockResolvedValueOnce({
        id: 'shop_2',
        slug: 'my-store',
      } as any);

      const res = await createShop({
        name: 'My Store',
        slug: 'my-store',
        whatsapp: '+12345678900',
      });

      expect(res.error).toBe('This storefront URL handle is already taken');
      expect(db.shop.findUnique).toHaveBeenNthCalledWith(2, {
        where: { slug: 'my-store' },
      });
    });

    it('creates shop successfully and upgrades user role to SELLER', async () => {
      vi.mocked(auth as any).mockResolvedValue({
        user: { id: 'user_1', role: 'USER' },
        expires: '',
      });
      // 1. check owner's shop => null
      vi.mocked(db.shop.findUnique).mockResolvedValueOnce(null);
      // 2. check slug uniqueness => null
      vi.mocked(db.shop.findUnique).mockResolvedValueOnce(null);

      const mockShop = {
        id: 'new_shop_id',
        ownerId: 'user_1',
        name: 'My Store',
        slug: 'my-store',
        whatsapp: '+12345678900',
        isVerified: false,
      };
      vi.mocked(db.shop.create).mockResolvedValueOnce(mockShop as any);

      const res = await createShop({
        name: 'My Store',
        slug: 'my-store',
        whatsapp: '+12345678900',
      });

      expect(res.success).toBe(true);
      expect(res.shop).toEqual(mockShop);

      expect(db.shop.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ownerId: 'user_1',
          name: 'My Store',
          slug: 'my-store',
          whatsapp: '+12345678900',
          isVerified: false,
        }),
      });

      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: 'user_1' },
        data: { role: Role.SELLER },
      });

      expect(revalidatePath).toHaveBeenCalledWith('/');
      expect(revalidatePath).toHaveBeenCalledWith('/marketplace');
      expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('updateShop', () => {
    const validShopId = 'clj1234560000xx7890abcdef'; // Valid CUID

    it('fails if shopId is not a valid CUID format', async () => {
      const res = await updateShop('invalid-id', {
        name: 'Updated Shop Name',
        slug: 'updated-slug',
        whatsapp: '+12345678900',
      });

      expect(res.error).toBe('Invalid shop ID format');
    });

    it('fails if user is unauthorized', async () => {
      vi.mocked(auth as any).mockResolvedValue(null);

      const res = await updateShop(validShopId, {
        name: 'Updated Shop Name',
        slug: 'updated-slug',
        whatsapp: '+12345678900',
      });

      expect(res.error).toBe('Unauthorized');
    });

    it('fails if shop is not found', async () => {
      vi.mocked(auth as any).mockResolvedValue({
        user: { id: 'user_1', role: 'USER' },
        expires: '',
      });
      vi.mocked(db.shop.findUnique).mockResolvedValueOnce(null);

      const res = await updateShop(validShopId, {
        name: 'Updated Shop Name',
        slug: 'updated-slug',
        whatsapp: '+12345678900',
      });

      expect(res.error).toBe('Storefront not found');
    });

    it('fails if the user is neither owner nor admin', async () => {
      vi.mocked(auth as any).mockResolvedValue({
        user: { id: 'user_2', role: 'USER' }, // Different user
        expires: '',
      });
      vi.mocked(db.shop.findUnique).mockResolvedValueOnce({
        id: validShopId,
        ownerId: 'user_1', // Owned by user_1
        name: 'Original Shop',
        slug: 'original-slug',
      } as any);

      const res = await updateShop(validShopId, {
        name: 'Updated Shop Name',
        slug: 'updated-slug',
        whatsapp: '+12345678900',
      });

      expect(res.error).toBe('You do not have permission to manage this store');
    });

    it('fails validation on invalid input fields', async () => {
      vi.mocked(auth as any).mockResolvedValue({
        user: { id: 'user_1', role: 'USER' },
        expires: '',
      });
      vi.mocked(db.shop.findUnique).mockResolvedValueOnce({
        id: validShopId,
        ownerId: 'user_1',
        name: 'Original Shop',
        slug: 'original-slug',
      } as any);

      const res = await updateShop(validShopId, {
        name: '', // Invalid name
        slug: 'bad_slug', // Invalid slug regex
        whatsapp: 'invalid_number',
      });

      expect(res.error).toBeDefined();
    });

    it('fails if slug is changed and new slug is already taken', async () => {
      vi.mocked(auth as any).mockResolvedValue({
        user: { id: 'user_1', role: 'USER' },
        expires: '',
      });
      // 1. check shop exists => returns original shop
      vi.mocked(db.shop.findUnique).mockResolvedValueOnce({
        id: validShopId,
        ownerId: 'user_1',
        name: 'Original Shop',
        slug: 'original-slug',
      } as any);
      // 2. check slug uniqueness for the new slug => returns another shop
      vi.mocked(db.shop.findUnique).mockResolvedValueOnce({
        id: 'some_other_shop',
        slug: 'taken-slug',
      } as any);

      const res = await updateShop(validShopId, {
        name: 'Original Shop',
        slug: 'taken-slug', // New slug
        whatsapp: '+12345678900',
      });

      expect(res.error).toBe('This storefront URL handle is already taken');
    });

    it('updates shop successfully when requested by owner', async () => {
      vi.mocked(auth as any).mockResolvedValue({
        user: { id: 'user_1', role: 'SELLER' },
        expires: '',
      });
      // 1. check shop exists => returns original shop
      vi.mocked(db.shop.findUnique).mockResolvedValueOnce({
        id: validShopId,
        ownerId: 'user_1',
        name: 'Original Shop',
        slug: 'original-slug',
      } as any);
      // 2. check slug uniqueness for new slug => returns null
      vi.mocked(db.shop.findUnique).mockResolvedValueOnce(null);

      const mockUpdatedShop = {
        id: validShopId,
        ownerId: 'user_1',
        name: 'Updated Shop Name',
        slug: 'new-slug',
        whatsapp: '+19876543210',
      };
      vi.mocked(db.shop.update).mockResolvedValueOnce(mockUpdatedShop as any);

      const res = await updateShop(validShopId, {
        name: 'Updated Shop Name',
        slug: 'new-slug',
        whatsapp: '+19876543210',
      });

      expect(res.success).toBe(true);
      expect(res.shop).toEqual(mockUpdatedShop);
      expect(db.shop.update).toHaveBeenCalledWith({
        where: { id: validShopId },
        data: expect.objectContaining({
          name: 'Updated Shop Name',
          slug: 'new-slug',
          whatsapp: '+19876543210',
        }),
      });

      expect(revalidatePath).toHaveBeenCalledWith('/store/original-slug');
      expect(revalidatePath).toHaveBeenCalledWith('/store/new-slug');
      expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
    });

    it('updates shop successfully when requested by admin', async () => {
      vi.mocked(auth as any).mockResolvedValue({
        user: { id: 'admin_1', role: Role.ADMIN },
        expires: '',
      });
      // 1. check shop exists => returns original shop owned by user_1
      vi.mocked(db.shop.findUnique).mockResolvedValueOnce({
        id: validShopId,
        ownerId: 'user_1',
        name: 'Original Shop',
        slug: 'original-slug',
      } as any);

      const mockUpdatedShop = {
        id: validShopId,
        ownerId: 'user_1',
        name: 'Updated by Admin',
        slug: 'original-slug', // Same slug, so slug uniqueness check is skipped
        whatsapp: '+19876543210',
      };
      vi.mocked(db.shop.update).mockResolvedValueOnce(mockUpdatedShop as any);

      const res = await updateShop(validShopId, {
        name: 'Updated by Admin',
        slug: 'original-slug',
        whatsapp: '+19876543210',
      });

      expect(res.success).toBe(true);
      expect(res.shop).toEqual(mockUpdatedShop);
    });
  });
});
