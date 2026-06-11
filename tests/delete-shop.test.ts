import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteShop } from '../src/backend/actions/shops';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';

vi.mock('@/lib/db', () => {
  const mockDb = {
    shop: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(mockDb)),
  };
  return { db: mockDb };
});

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock('@/lib/supabase', () => ({
  uploadFile: vi.fn(),
  deleteFile: vi.fn().mockResolvedValue(undefined),
}));

describe('deleteShop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated users', async () => {
    vi.mocked(auth as any).mockResolvedValue(null);
    const res = await deleteShop();
    expect(res.error).toBe('Unauthorized');
    expect(db.shop.delete).not.toHaveBeenCalled();
  });

  it('rejects users without a storefront', async () => {
    vi.mocked(auth as any).mockResolvedValue({ user: { id: 'user_1' } } as any);
    vi.mocked(db.shop.findUnique).mockResolvedValue(null);
    const res = await deleteShop();
    expect(res.error).toBe('You do not own a storefront');
  });

  it('deletes the shop and demotes the user back to USER role', async () => {
    vi.mocked(auth as any).mockResolvedValue({ user: { id: 'user_1' } } as any);
    vi.mocked(db.shop.findUnique).mockResolvedValue({
      id: 'shop_1',
      slug: 'my-shop',
      logo: 'https://x.supabase.co/logos/a.png',
      banner: null,
      products: [
        { images: [{ url: 'https://x.supabase.co/products/p1.png' }] },
        { images: [] },
      ],
    } as any);
    vi.mocked(db.shop.delete).mockResolvedValue({} as any);
    vi.mocked(db.user.update).mockResolvedValue({} as any);

    const res = await deleteShop();

    expect(res.success).toBe(true);
    expect(db.shop.delete).toHaveBeenCalledWith({ where: { id: 'shop_1' } });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: { role: 'USER' },
    });
  });

  it('still deletes even if storage cleanup fails', async () => {
    const { deleteFile } = await import('@/lib/supabase');
    vi.mocked(deleteFile).mockRejectedValue(new Error('storage down'));
    vi.mocked(auth as any).mockResolvedValue({ user: { id: 'user_1' } } as any);
    vi.mocked(db.shop.findUnique).mockResolvedValue({
      id: 'shop_1',
      slug: 'my-shop',
      logo: 'https://x.supabase.co/logos/a.png',
      banner: 'https://x.supabase.co/banners/b.png',
      products: [{ images: [{ url: 'https://x.supabase.co/products/p1.png' }] }],
    } as any);
    vi.mocked(db.shop.delete).mockResolvedValue({} as any);
    vi.mocked(db.user.update).mockResolvedValue({} as any);

    const res = await deleteShop();
    expect(res.success).toBe(true);
  });
});
