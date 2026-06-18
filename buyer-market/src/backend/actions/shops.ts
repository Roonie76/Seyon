'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { deleteFile } from '@/lib/supabase';
import { ShopSchema } from '@/lib/zod-schemas';
import { rateLimit, RATE_LIMITS } from '../lib/rate-limit';
import { Role } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { logger } from '../lib/logger';
import { revalidateMarketplace, revalidateShopSurface } from '@/shared/lib/cache';

const IdParamSchema = z.string().cuid('Invalid identifier format');

export async function createShop(rawData: unknown) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return { error: 'You must be logged in to create a shop' };
    }

    const userId = session.user.id;

    const rl = rateLimit(`shop-create:${userId}`, RATE_LIMITS.SHOP_CREATE.limit, RATE_LIMITS.SHOP_CREATE.windowMs);
    if (!rl.success) {
      return { error: 'Too many shop creation attempts today. Please try again later.' };
    }

    // Check if user already owns a shop
    const existingShop = await db.shop.findUnique({
      where: { ownerId: userId },
    });

    if (existingShop) {
      return { error: 'You already own a storefront on this platform' };
    }

    // Validate inputs
    const validated = ShopSchema.safeParse(rawData);
    if (!validated.success) {
      return { error: validated.error.issues[0].message };
    }

    // Verify slug uniqueness
    const slugExists = await db.shop.findUnique({
      where: { slug: validated.data.slug },
    });

    if (slugExists) {
      return { error: 'This storefront URL handle is already taken' };
    }

    // Create the shop and upgrade user's role to SELLER
    const shop = await db.$transaction(async (tx) => {
      const newShop = await tx.shop.create({
        data: {
          ownerId: userId,
          name: validated.data.name,
          slug: validated.data.slug,
          description: validated.data.description || null,
          logo: validated.data.logo || null,
          banner: validated.data.banner || null,
          whatsapp: validated.data.whatsapp,
          instagram: validated.data.instagram || null,
          telegram: validated.data.telegram || null,
          city: validated.data.city || null,
          region: validated.data.region || null,
          deliveryNote: validated.data.deliveryNote || null,
          isVerified: false,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { role: Role.SELLER },
      });

      return newShop;
    });

    revalidatePath('/');
    revalidateMarketplace();
    revalidatePath('/dashboard');
    return { success: true, shop };
  } catch (error) {
    logger.error('Error creating shop', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return { error: errorMessage };
  }
}

export async function updateShop(shopId: string, rawData: unknown) {
  try {
    const parsedShopId = IdParamSchema.safeParse(shopId);
    if (!parsedShopId.success) {
      return { error: 'Invalid shop ID format' };
    }

    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return { error: 'Unauthorized' };
    }

    const existingShop = await db.shop.findUnique({
      where: { id: parsedShopId.data },
    });

    if (!existingShop) {
      return { error: 'Storefront not found' };
    }

    // Authenticate owner or admin
    if (existingShop.ownerId !== session.user.id && session.user.role !== Role.ADMIN) {
      return { error: 'You do not have permission to manage this store' };
    }

    const validated = ShopSchema.safeParse(rawData);
    if (!validated.success) {
      return { error: validated.error.issues[0].message };
    }

    // If slug changed, verify uniqueness
    if (validated.data.slug !== existingShop.slug) {
      const slugExists = await db.shop.findUnique({
        where: { slug: validated.data.slug },
      });
      if (slugExists) {
        return { error: 'This storefront URL handle is already taken' };
      }
    }

    const updatedShop = await db.shop.update({
      where: { id: parsedShopId.data },
      data: {
        name: validated.data.name,
        slug: validated.data.slug,
        description: validated.data.description || null,
        logo: validated.data.logo || null,
        banner: validated.data.banner || null,
        whatsapp: validated.data.whatsapp,
        whatsappVerifiedAt: validated.data.whatsapp === existingShop.whatsapp ? existingShop.whatsappVerifiedAt : null,
        instagram: validated.data.instagram || null,
        telegram: validated.data.telegram || null,
        city: validated.data.city || null,
        region: validated.data.region || null,
        deliveryNote: validated.data.deliveryNote || null,
      },
    });

    revalidateShopSurface(existingShop.slug);
    revalidateShopSurface(updatedShop.slug);
    revalidatePath('/dashboard');
    return { success: true, shop: updatedShop };
  } catch (error) {
    logger.error('Error updating shop', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return { error: errorMessage };
  }
}

export async function deleteShop() {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return { error: 'Unauthorized' };
    }

    const shop = await db.shop.findUnique({
      where: { ownerId: session.user.id },
      include: {
        products: {
          include: { images: { select: { url: true } } },
        },
      },
    });

    if (!shop) {
      return { error: 'You do not own a storefront' };
    }

    // Best-effort storage cleanup; DB rows cascade via Prisma relations.
    const imageUrls = shop.products.flatMap((p) => p.images.map((img) => img.url));
    for (const url of imageUrls) {
      try {
        await deleteFile(url, 'products');
      } catch {
        // Orphaned files are acceptable; never block deletion on storage
      }
    }
    if (shop.logo) {
      try { await deleteFile(shop.logo, 'logos'); } catch { /* best-effort */ }
    }
    if (shop.banner) {
      try { await deleteFile(shop.banner, 'banners'); } catch { /* best-effort */ }
    }

    await db.$transaction(async (tx) => {
      await tx.shop.delete({ where: { id: shop.id } });
      // Hand back the regular buyer role so the landing page shows again
      await tx.user.update({
        where: { id: session.user.id as string },
        data: { role: Role.USER },
      });
    });

    revalidateShopSurface(shop.slug);
    revalidateMarketplace();
    revalidatePath('/sell');
    revalidatePath('/dashboard');

    logger.info('Storefront deleted by owner', { shopId: shop.id, slug: shop.slug });
    return { success: true };
  } catch (error) {
    logger.error('Error deleting shop', error);
    return { error: error instanceof Error ? error.message : 'An unexpected error occurred' };
  }
}

export async function toggleShopPause(isPaused: boolean) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return { error: 'Unauthorized' };
    }

    const shop = await db.shop.findUnique({
      where: { ownerId: session.user.id },
      select: { id: true, slug: true },
    });

    if (!shop) {
      return { error: 'You do not own a storefront' };
    }

    const updated = await db.shop.update({
      where: { id: shop.id },
      data: { isPaused: Boolean(isPaused) },
    });

    revalidateShopSurface(shop.slug);
    revalidatePath('/dashboard');
    return { success: true, isPaused: updated.isPaused };
  } catch (error) {
    logger.error('Error toggling shop pause', error);
    return { error: error instanceof Error ? error.message : 'An unexpected error occurred' };
  }
}

export async function getShopBySlug(slug: string) {
  const cleanSlug = slug.trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(cleanSlug)) {
    return null;
  }

  const shop = await db.shop.findUnique({
    where: { slug: cleanSlug },
    include: {
      _count: {
        select: { products: true },
      },
      owner: {
        select: {
          emailVerified: true,
          phone: true,
          createdAt: true,
        },
      },
      products: {
        where: { status: 'ACTIVE' },
        include: {
          images: {
            orderBy: { displayOrder: 'asc' },
          },
        },
      },
      reviews: {
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { name: true, image: true },
          },
        },
      },
      reports: {
        where: { status: 'OPEN' },
        select: {
          id: true, // Only select ID to prevent leaking PII (userId, reason) to the public storefront
        },
      },
    },
  });
  if (!shop) return null;
  // Mask the owner's phone number to protect personal privacy, preserving type check phone !== null
  if (shop.owner) {
    shop.owner.phone = shop.owner.phone ? 'hidden' : null;
  }
  return shop;
}
