'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { deleteFile, storagePrefixForShop } from '@/lib/supabase';
import { ShopSchema } from '@/lib/zod-schemas';
import { rateLimit, RATE_LIMITS } from '../lib/rate-limit';
import { Role } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { logger } from '../lib/logger';
import { revalidateMarketplace, revalidateShopSurface } from '@/shared/lib/cache';
import { toUserMessage, CONFLICT_ERROR } from '../lib/action-errors';
import { PUBLIC_REVIEW } from '../lib/shop-visibility';

const IdParamSchema = z.string().cuid('Invalid identifier format');

export async function createShop(rawData: unknown) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return { error: 'You must be logged in to create a shop' };
    }

    const userId = session.user.id;

    const rl = await rateLimit(`shop-create:${userId}`, RATE_LIMITS.SHOP_CREATE.limit, RATE_LIMITS.SHOP_CREATE.windowMs);
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
    return { error: toUserMessage(error, { action: 'createShop' }) };
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

    // Optimistic concurrency: refuse the write if the row moved since the
    // client read it, rather than silently overwriting the other editor.
    if (validated.data.expectedUpdatedAt) {
      const expected = new Date(validated.data.expectedUpdatedAt);
      if (
        !Number.isNaN(expected.getTime()) &&
        existingShop.updatedAt.getTime() !== expected.getTime()
      ) {
        return { error: CONFLICT_ERROR, conflict: true as const };
      }
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
    return { error: toUserMessage(error, { action: 'updateShop', shopId }) };
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

    const imageUrls = shop.products.flatMap((p) => p.images.map((img) => img.url));

    await db.$transaction(async (tx) => {
      await tx.shop.delete({ where: { id: shop.id } });
      // Hand back the regular buyer role so the landing page shows again
      await tx.user.update({
        where: { id: session.user.id as string },
        data: { role: Role.USER },
      });
    });

    // Storage cleanup only after the database delete has committed. Doing it
    // first meant a failed transaction left a live shop with dead image URLs.
    const prefix = storagePrefixForShop(shop.id);
    for (const url of imageUrls) {
      try {
        await deleteFile(url, 'products', prefix);
      } catch {
        // Orphaned files are acceptable; never block deletion on storage
      }
    }
    if (shop.logo) {
      try { await deleteFile(shop.logo, 'logos', prefix); } catch { /* best-effort */ }
    }
    if (shop.banner) {
      try { await deleteFile(shop.banner, 'banners', prefix); } catch { /* best-effort */ }
    }

    revalidateShopSurface(shop.slug);
    revalidateMarketplace();
    revalidatePath('/sell');
    revalidatePath('/dashboard');

    logger.info('Storefront deleted by owner', { shopId: shop.id, slug: shop.slug });
    return { success: true };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'deleteShop' }) };
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
    return { error: toUserMessage(error, { action: 'toggleShopPause' }) };
  }
}

