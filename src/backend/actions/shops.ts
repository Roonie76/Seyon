'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ShopSchema } from '@/lib/zod-schemas';
import { Role } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const IdParamSchema = z.string().cuid('Invalid identifier format');

export async function createShop(rawData: unknown) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return { error: 'You must be logged in to create a shop' };
    }

    const userId = session.user.id;

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
          description: validated.data.description,
          logo: validated.data.logo,
          banner: validated.data.banner,
          whatsapp: validated.data.whatsapp,
          instagram: validated.data.instagram,
          telegram: validated.data.telegram,
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
    revalidatePath('/marketplace');
    revalidatePath('/dashboard');
    return { success: true, shop };
  } catch (error) {
    console.error('Error creating shop:', error);
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
        description: validated.data.description,
        logo: validated.data.logo,
        banner: validated.data.banner,
        whatsapp: validated.data.whatsapp,
        instagram: validated.data.instagram,
        telegram: validated.data.telegram,
      },
    });

    revalidatePath(`/store/${existingShop.slug}`);
    revalidatePath(`/store/${updatedShop.slug}`);
    revalidatePath('/dashboard');
    return { success: true, shop: updatedShop };
  } catch (error) {
    console.error('Error updating shop:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return { error: errorMessage };
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

