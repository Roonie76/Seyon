'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Role, ReportStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';

import { z } from 'zod';
import { logger } from '../lib/logger';
import { notify } from '../lib/notify';
import { deleteFile, storagePrefixForShop } from '@/lib/supabase';
import { revalidateMarketplace, revalidateShopSurface } from '@/shared/lib/cache';

const IdParamSchema = z.string().cuid('Invalid identifier format');
const RoleSchema = z.nativeEnum(Role);
const ReportStatusSchema = z.nativeEnum(ReportStatus);

async function verifyAdminAuth() {
  const session = await auth();
  if (!session || !session.user || session.user.role !== Role.ADMIN) {
    throw new Error('Forbidden: Admin authorization required');
  }
  return session;
}

export async function getAdminDashboardStats() {
  try {
    await verifyAdminAuth();

    const [
      totalSellers,
      totalProducts,
      totalStores,
      reports,
      dailySignups,
    ] = await Promise.all([
      db.user.count({ where: { role: Role.SELLER } }),
      db.product.count(),
      db.shop.count(),
      db.report.findMany({
        where: { status: { in: [ReportStatus.OPEN, ReportStatus.UNDER_REVIEW] } },
        include: {
          shop: { select: { name: true, slug: true } },
          user: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 200, // bound the moderation queue view
      }),
      // Count signups in the last 24h
      db.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // Calculate most viewed stores (grouped in DB or count analytics)
    const storeViews = await db.analytics.groupBy({
      by: ['shopId'],
      where: { eventType: 'SHOP_VIEW' },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    const popularShops = await Promise.all(
      storeViews.map(async (v) => {
        const shop = await db.shop.findUnique({
          where: { id: v.shopId },
          select: { name: true, slug: true },
        });
        return {
          name: shop?.name || 'Unknown',
          slug: shop?.slug || '',
          views: v._count.id,
        };
      })
    );

    // Calculate most viewed products
    const productViews = await db.analytics.groupBy({
      by: ['productId'],
      where: { eventType: 'PRODUCT_VIEW', productId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    const popularProducts = await Promise.all(
      productViews.map(async (v) => {
        const product = await db.product.findUnique({
          where: { id: v.productId! },
          select: { title: true, slug: true, shop: { select: { slug: true } } },
        });
        return {
          title: product?.title || 'Unknown',
          slug: product?.slug || '',
          shopSlug: product?.shop?.slug || '',
          views: v._count.id,
        };
      })
    );

    const allStoresList = await db.shop.findMany({
      include: {
        owner: { select: { email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500, // bound the admin table; add pagination before shop count approaches this
    });

    return {
      success: true,
      stats: {
        totalSellers,
        totalProducts,
        totalStores,
        dailySignups,
        reportsCount: reports.length,
      },
      reports,
      popularShops,
      popularProducts,
      allStores: allStoresList,
    };
  } catch (error) {
    logger.error('Error fetching admin dashboard stats', error);
    return { error: error instanceof Error ? error.message : 'An unexpected error occurred' };
  }
}

export async function verifyShopAction(shopId: string, isVerified: boolean) {
  try {
    const parsedShopId = IdParamSchema.safeParse(shopId);
    if (!parsedShopId.success) {
      return { error: 'Invalid shop ID format' };
    }

    if (typeof isVerified !== 'boolean') {
      return { error: 'Invalid parameter type for verification status' };
    }

    await verifyAdminAuth();

    const shop = await db.shop.update({
      where: { id: parsedShopId.data },
      data: { isVerified },
    });

    revalidateShopSurface(shop.slug);
    revalidatePath('/admin');
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'An unexpected error occurred' };
  }
}

export async function suspendShopAction(shopId: string, isSuspended: boolean) {
  try {
    const parsedShopId = IdParamSchema.safeParse(shopId);
    if (!parsedShopId.success) {
      return { error: 'Invalid shop ID format' };
    }

    if (typeof isSuspended !== 'boolean') {
      return { error: 'Invalid parameter type for suspension status' };
    }

    await verifyAdminAuth();

    const shop = await db.shop.update({
      where: { id: parsedShopId.data },
      data: { isSuspended },
      include: { owner: { select: { email: true } } },
    });

    // Notify the owner (fire-and-forget)
    if (shop.owner?.email) {
      notify({
        to: shop.owner.email,
        subject: isSuspended
          ? `Your storefront "${shop.name}" has been suspended`
          : `Your storefront "${shop.name}" has been reinstated`,
        text: isSuspended
          ? `Your storefront "${shop.name}" on Seyon was suspended by a moderator and is no longer visible to buyers. If you believe this is a mistake, reply to this email.`
          : `Good news — your storefront "${shop.name}" on Seyon has been reinstated and is visible to buyers again.`,
      }).catch(() => undefined);
    }

    revalidateShopSurface(shop.slug);
    revalidatePath('/admin');
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'An unexpected error occurred' };
  }
}

export async function resolveReportAction(reportId: string, status: ReportStatus) {
  try {
    const parsedReportId = IdParamSchema.safeParse(reportId);
    if (!parsedReportId.success) {
      return { error: 'Invalid report ID format' };
    }

    const parsedStatus = ReportStatusSchema.safeParse(status);
    if (!parsedStatus.success) {
      return { error: 'Invalid status type' };
    }

    await verifyAdminAuth();

    const report = await db.report.update({
      where: { id: parsedReportId.data },
      data: { status: parsedStatus.data },
      include: { shop: true, user: { select: { email: true } } },
    });

    // Notify the reporter when their report reaches a final state (fire-and-forget)
    if (report.user?.email && parsedStatus.data === 'RESOLVED') {
      notify({
        to: report.user.email,
        subject: `Update on your report about "${report.shop.name}"`,
        text: `Thanks for helping keep Seyon safe. Your report about the storefront "${report.shop.name}" has been reviewed and resolved by our moderation team.`,
      }).catch(() => undefined);
    }

    revalidateShopSurface(report.shop.slug);
    revalidatePath('/admin');
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'An unexpected error occurred' };
  }
}

export async function deleteProductAction(productId: string) {
  try {
    const parsedProductId = IdParamSchema.safeParse(productId);
    if (!parsedProductId.success) {
      return { error: 'Invalid product ID format' };
    }

    await verifyAdminAuth();

    const product = await db.product.findUnique({
      where: { id: parsedProductId.data },
      include: { images: true },
    });

    if (!product) return { error: 'Product not found' };

    // Delete database records first; storage cleanup afterwards, so a failed
    // delete cannot leave a live product pointing at removed files.
    await db.product.delete({
      where: { id: parsedProductId.data },
    });

    const prefix = storagePrefixForShop(product.shopId);
    for (const img of product.images) {
      try {
        await deleteFile(img.url, 'products', prefix);
      } catch {
        // Orphaned files are acceptable; log happens inside deleteFile
      }
    }

    revalidateMarketplace();

    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'An unexpected error occurred' };
  }
}

export async function updateUserRoleAction(userId: string, role: Role) {
  try {
    const parsedUserId = IdParamSchema.safeParse(userId);
    if (!parsedUserId.success) {
      return { error: 'Invalid user ID format' };
    }

    const parsedRole = RoleSchema.safeParse(role);
    if (!parsedRole.success) {
      return { error: 'Invalid role' };
    }

    await verifyAdminAuth();

    await db.user.update({
      where: { id: parsedUserId.data },
      data: { role: parsedRole.data },
    });

    revalidatePath('/admin');
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'An unexpected error occurred' };
  }
}
