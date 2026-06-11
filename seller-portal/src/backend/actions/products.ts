'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ProductSchema, ReorderImagesSchema } from '@/lib/zod-schemas';
import { rateLimit, RATE_LIMITS } from '../lib/rate-limit';
import { Role } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { deleteFile } from '@/lib/supabase';
import { z } from 'zod';
import { logger } from '../lib/logger';
import { revalidateShopSurface } from '@/shared/lib/cache';

const IdParamSchema = z.string().cuid('Invalid identifier format');

// Helper to make title into slug
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-'); // Replace multiple - with single -
}

async function verifyShopOwnership(shopId: string) {
  const parsedShopId = IdParamSchema.safeParse(shopId);
  if (!parsedShopId.success) {
    throw new Error('Invalid shop ID format');
  }

  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    throw new Error('Unauthenticated');
  }

  const shop = await db.shop.findUnique({
    where: { id: parsedShopId.data },
  });

  if (!shop) {
    throw new Error('Shop not found');
  }

  if (shop.ownerId !== session.user.id && session.user.role !== Role.ADMIN) {
    throw new Error('Unauthorized store management');
  }

  return { session, shop };
}

export async function createProduct(shopId: string, rawData: unknown) {
  try {
    const parsedShopId = IdParamSchema.safeParse(shopId);
    if (!parsedShopId.success) {
      return { error: 'Invalid shop ID format' };
    }

    const { shop } = await verifyShopOwnership(parsedShopId.data);

    const rl = rateLimit(`product-create:${shop.ownerId}`, RATE_LIMITS.PRODUCT_CREATE.limit, RATE_LIMITS.PRODUCT_CREATE.windowMs);
    if (!rl.success) {
      return { error: 'Too many products created today. Please try again later.' };
    }

    const validated = ProductSchema.safeParse(rawData);
    if (!validated.success) {
      return { error: validated.error.issues[0].message };
    }

    const { title, description, price, compareAtPrice, category, options, inStock, status, images } = validated.data;
    
    // Base slug
    const slug = slugify(title);
    
    // Handle collisions
    let counter = 0;
    let finalSlug = slug;
    while (true) {
      const match = await db.product.findUnique({
        where: {
          shopId_slug: {
            shopId: parsedShopId.data,
            slug: finalSlug,
          },
        },
      });
      if (!match) break;
      counter++;
      finalSlug = `${slug}-${counter}`;
    }

    const product = await db.product.create({
      data: {
        shopId: parsedShopId.data,
        title,
        slug: finalSlug,
        description,
        price,
        compareAtPrice: compareAtPrice ?? null,
        category,
        options: options || null,
        inStock,
        status,
        images: {
          create: images.map((img, idx) => ({
            url: img.url,
            displayOrder: img.displayOrder ?? idx,
            isPrimary: img.isPrimary ?? (idx === 0),
          })),
        },
      },
      include: {
        images: true,
      },
    });

    revalidateShopSurface(shop.slug, product.slug, product.category);
    revalidatePath('/dashboard/products');
    return { success: true, product };
  } catch (error) {
    logger.error('Error creating product', error);
    return { error: error instanceof Error ? error.message : 'An unexpected error occurred' };
  }
}

export async function updateProduct(productId: string, rawData: unknown) {
  try {
    const parsedProductId = IdParamSchema.safeParse(productId);
    if (!parsedProductId.success) {
      return { error: 'Invalid product ID format' };
    }

    const product = await db.product.findUnique({
      where: { id: parsedProductId.data },
      include: { images: true },
    });

    if (!product) {
      return { error: 'Product not found' };
    }

    // Authenticate and verify owner permission for the shop that owns the product
    const { shop } = await verifyShopOwnership(product.shopId);

    const validated = ProductSchema.safeParse(rawData);
    if (!validated.success) {
      return { error: validated.error.issues[0].message };
    }

    const { title, description, price, compareAtPrice, category, options, inStock, status, images } = validated.data;
    
    // Determine if slug needs updating
    let finalSlug = product.slug;
    if (title !== product.title) {
      const slug = slugify(title);
      let counter = 0;
      finalSlug = slug;
      while (true) {
        const match = await db.product.findFirst({
          where: {
            shopId: product.shopId,
            slug: finalSlug,
            NOT: { id: parsedProductId.data },
          },
        });
        if (!match) break;
        counter++;
        finalSlug = `${slug}-${counter}`;
      }
    }

    // Delete removed images in storage
    const newUrls = new Set(images.map((img) => img.url));
    const urlsToDelete = product.images
      .filter((img) => !newUrls.has(img.url))
      .map((img) => img.url);

    for (const url of urlsToDelete) {
      await deleteFile(url, 'products');
    }

    // Update product inside a database transaction
    const updatedProduct = await db.$transaction(async (tx) => {
      // Clear current images mapping in DB
      await tx.productImage.deleteMany({
        where: { productId: parsedProductId.data },
      });

      // Update product record
      return await tx.product.update({
        where: { id: parsedProductId.data },
        data: {
          title,
          slug: finalSlug,
          description,
          price,
          compareAtPrice: compareAtPrice ?? null,
          category,
          options: options || null,
          inStock,
          status,
          images: {
            create: images.map((img, idx) => ({
              url: img.url,
              displayOrder: img.displayOrder ?? idx,
              isPrimary: img.isPrimary ?? (idx === 0),
            })),
          },
        },
        include: {
          images: true,
        },
      });
    });

    revalidateShopSurface(shop.slug, product.slug, product.category);
    revalidateShopSurface(shop.slug, updatedProduct.slug, updatedProduct.category);
    revalidatePath('/dashboard/products');
    return { success: true, product: updatedProduct };
  } catch (error) {
    logger.error('Error updating product', error);
    return { error: error instanceof Error ? error.message : 'An unexpected error occurred' };
  }
}

const QuickAddSchema = z.array(z.string().url('Invalid image URL')).min(1, 'At least one image required').max(12, 'Maximum 12 images per quick-add');

/**
 * Bulk onboarding helper: every uploaded image becomes a DRAFT product the
 * seller then titles and prices. Drafts are invisible to buyers until edited
 * and switched to ACTIVE.
 */
export async function quickAddProducts(shopId: string, rawImageUrls: unknown) {
  try {
    const parsedShopId = IdParamSchema.safeParse(shopId);
    if (!parsedShopId.success) {
      return { error: 'Invalid shop ID format' };
    }

    const { shop } = await verifyShopOwnership(parsedShopId.data);

    const validated = QuickAddSchema.safeParse(rawImageUrls);
    if (!validated.success) {
      return { error: validated.error.issues[0].message };
    }

    const rl = rateLimit(`product-create:${shop.ownerId}`, RATE_LIMITS.PRODUCT_CREATE.limit, RATE_LIMITS.PRODUCT_CREATE.windowMs);
    if (!rl.success) {
      return { error: 'Too many products created today. Please try again later.' };
    }

    const created = [];
    for (const [idx, url] of validated.data.entries()) {
      const baseSlug = `untitled-product-${Date.now()}-${idx}`;
      const product = await db.product.create({
        data: {
          shopId: parsedShopId.data,
          title: 'Untitled product',
          slug: baseSlug,
          description: null,
          price: 0,
          category: 'Other',
          status: 'DRAFT',
          inStock: true,
          images: {
            create: [{ url, displayOrder: 0, isPrimary: true }],
          },
        },
        select: { id: true },
      });
      created.push(product.id);
    }

    revalidatePath('/dashboard/products');
    return { success: true, count: created.length };
  } catch (error) {
    logger.error('Error in quick-add products', error);
    return { error: error instanceof Error ? error.message : 'An unexpected error occurred' };
  }
}

export async function toggleProductStock(productId: string, inStock: boolean) {
  try {
    const parsedProductId = IdParamSchema.safeParse(productId);
    if (!parsedProductId.success) {
      return { error: 'Invalid product ID format' };
    }

    const product = await db.product.findUnique({
      where: { id: parsedProductId.data },
      select: { id: true, slug: true, shopId: true },
    });

    if (!product) {
      return { error: 'Product not found' };
    }

    const { shop } = await verifyShopOwnership(product.shopId);

    const updated = await db.product.update({
      where: { id: parsedProductId.data },
      data: { inStock: Boolean(inStock) },
    });

    revalidateShopSurface(shop.slug, product.slug, updated.category);
    revalidatePath('/dashboard/products');
    return { success: true, inStock: updated.inStock };
  } catch (error) {
    logger.error('Error toggling product stock', error);
    return { error: error instanceof Error ? error.message : 'An unexpected error occurred' };
  }
}

export async function deleteProduct(productId: string) {
  try {
    const parsedProductId = IdParamSchema.safeParse(productId);
    if (!parsedProductId.success) {
      return { error: 'Invalid product ID format' };
    }

    const product = await db.product.findUnique({
      where: { id: parsedProductId.data },
      include: { images: true },
    });

    if (!product) {
      return { error: 'Product not found' };
    }

    const { shop } = await verifyShopOwnership(product.shopId);

    // Delete images from Supabase Storage
    for (const img of product.images) {
      await deleteFile(img.url, 'products');
    }

    // Delete product from DB
    await db.product.delete({
      where: { id: parsedProductId.data },
    });

    revalidateShopSurface(shop.slug, product.slug, product.category);
    revalidatePath('/dashboard/products');
    return { success: true };
  } catch (error) {
    logger.error('Error deleting product', error);
    return { error: error instanceof Error ? error.message : 'An unexpected error occurred' };
  }
}

export async function reorderProductImages(productId: string, reorderedImages: unknown) {
  try {
    const parsedProductId = IdParamSchema.safeParse(productId);
    if (!parsedProductId.success) {
      return { error: 'Invalid product ID format' };
    }

    const product = await db.product.findUnique({
      where: { id: parsedProductId.data },
    });

    if (!product) {
      return { error: 'Product not found' };
    }

    await verifyShopOwnership(product.shopId);

    const validatedImages = ReorderImagesSchema.safeParse(reorderedImages);
    if (!validatedImages.success) {
      return { error: 'Invalid images data format' };
    }

    // Validate that the images being reordered actually belong to the current product to prevent ID manipulation
    const dbImages = await db.productImage.findMany({
      where: { productId: parsedProductId.data },
      select: { id: true },
    });
    const dbImageIds = new Set(dbImages.map((img) => img.id));
    for (const img of validatedImages.data) {
      if (!dbImageIds.has(img.id)) {
        return { error: 'Unauthorized image update: Image does not belong to this product' };
      }
    }

    await db.$transaction(
      validatedImages.data.map((img) =>
        db.productImage.update({
          where: { id: img.id },
          data: {
            displayOrder: img.displayOrder,
            isPrimary: img.isPrimary,
          },
        })
      )
    );

    return { success: true };
  } catch (error) {
    logger.error('Error reordering images', error);
    return { error: error instanceof Error ? error.message : 'An unexpected error occurred' };
  }
}
