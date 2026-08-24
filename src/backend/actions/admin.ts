'use server';

import { db } from '@/lib/db';
import { Role, ReportStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';

import { z } from 'zod';
import { logger } from '../lib/logger';
import { notify } from '../lib/notify';
import { deleteFile, storagePrefixForShop } from '@/lib/supabase';
import { revalidateMarketplace, revalidateShopSurface } from '@/shared/lib/cache';
import { recordAdminAction, ADMIN_ACTIONS } from '../lib/admin-audit';
import { requireAdmin } from '../lib/require-admin';
import { issueNotice, emailNotice } from '../lib/notices';

const IdParamSchema = z.string().cuid('Invalid identifier format');
const RoleSchema = z.nativeEnum(Role);
const ReportStatusSchema = z.nativeEnum(ReportStatus);

/**
 * Admin authorisation now lives in `lib/require-admin`, because moderation,
 * complaints, notices and access control all need exactly this check and four
 * copies of an authorisation routine is four places for one of them to lose
 * the database read.
 */
const verifyAdminAuth = requireAdmin;

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

    const { actorId } = await verifyAdminAuth();

    const shop = await db.$transaction(async (tx) => {
      const updated = await tx.shop.update({
        where: { id: parsedShopId.data },
        data: { isVerified },
      });
      await recordAdminAction(
        {
          actorId,
          action: isVerified ? ADMIN_ACTIONS.VERIFY_SHOP : ADMIN_ACTIONS.UNVERIFY_SHOP,
          targetType: 'Shop',
          targetId: updated.id,
          metadata: { slug: updated.slug, isVerified },
        },
        tx
      );
      return updated;
    });

    revalidateShopSurface(shop.slug);
    revalidatePath('/admin', 'layout'); // covers /admin/stores and /admin/stores/[slug]
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'An unexpected error occurred' };
  }
}

export async function suspendShopAction(shopId: string, isSuspended: boolean, reason?: string) {
  try {
    const parsedShopId = IdParamSchema.safeParse(shopId);
    if (!parsedShopId.success) {
      return { error: 'Invalid shop ID format' };
    }

    if (typeof isSuspended !== 'boolean') {
      return { error: 'Invalid parameter type for suspension status' };
    }

    const { actorId } = await verifyAdminAuth();

    // Suspension takes away a seller's income. It does not happen without a
    // stated reason — the seller is told, and support has to be able to
    // defend the decision later.
    if (isSuspended && !reason?.trim()) {
      return { error: 'Give a reason for the suspension. The seller is told what it says.' };
    }

    const { shop, noticeId } = await db.$transaction(async (tx) => {
      const updated = await tx.shop.update({
        where: { id: parsedShopId.data },
        data: { isSuspended },
        include: { owner: { select: { email: true } } },
      });
      await recordAdminAction(
        {
          actorId,
          action: isSuspended ? ADMIN_ACTIONS.SUSPEND_SHOP : ADMIN_ACTIONS.UNSUSPEND_SHOP,
          targetType: 'Shop',
          targetId: updated.id,
          reason: isSuspended ? reason : (reason ?? 'Reinstated'),
          metadata: { slug: updated.slug, isSuspended },
        },
        tx
      );

      // The seller's copy, stored rather than emailed. This used to be a single
      // fire-and-forget `notify()` call, which no-ops entirely when email is not
      // configured — so a seller could lose their storefront and never be told,
      // with nothing recording that we had tried.
      const notice = await issueNotice(
        {
          shopId: updated.id,
          actorId,
          kind: isSuspended ? 'SUSPENSION' : 'REINSTATEMENT',
          subject: isSuspended
            ? `Your storefront "${updated.name}" has been suspended`
            : `Your storefront "${updated.name}" has been reinstated`,
          body: isSuspended
            ? `Your storefront "${updated.name}" is no longer visible to buyers.\n\n` +
              `Reason given by the reviewer:\n${reason?.trim()}\n\n` +
              'If you believe this is a mistake, reply to this notice with anything that shows it.'
            : `Your storefront "${updated.name}" is visible to buyers again.` +
              (reason?.trim() ? `\n\nNote from the reviewer:\n${reason.trim()}` : ''),
          requiresResponse: isSuspended,
        },
        tx
      );

      return { shop: updated, noticeId: notice.id };
    });

    // Email is the convenience copy; the notice above is the record.
    emailNotice(noticeId).catch(() => undefined);

    revalidateShopSurface(shop.slug);
    revalidatePath('/admin', 'layout'); // covers /admin/stores and /admin/stores/[slug]
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

    const { actorId } = await verifyAdminAuth();

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

    await recordAdminAction({
      actorId,
      action: ADMIN_ACTIONS.RESOLVE_REPORT,
      targetType: 'Report',
      targetId: report.id,
      metadata: { status: parsedStatus.data, shopSlug: report.shop.slug },
    });

    revalidateShopSurface(report.shop.slug);
    revalidatePath('/admin', 'layout'); // covers /admin/stores and /admin/stores/[slug]
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'An unexpected error occurred' };
  }
}

export async function deleteProductAction(productId: string, reason?: string) {
  try {
    const parsedProductId = IdParamSchema.safeParse(productId);
    if (!parsedProductId.success) {
      return { error: 'Invalid product ID format' };
    }

    const { actorId } = await verifyAdminAuth();

    if (!reason?.trim()) {
      return { error: 'Give a reason for deleting this product. It is destroying a seller\'s work.' };
    }

    const product = await db.product.findUnique({
      where: { id: parsedProductId.data },
      include: { images: true },
    });

    if (!product) return { error: 'Product not found' };

    // Delete database records first; storage cleanup afterwards, so a failed
    // delete cannot leave a live product pointing at removed files. The audit
    // row is written in the same transaction as the delete, so a crash between
    // them cannot lose the record of what happened.
    await db.$transaction(async (tx) => {
      await recordAdminAction(
        {
          actorId,
          action: ADMIN_ACTIONS.DELETE_PRODUCT,
          targetType: 'Product',
          targetId: product.id,
          reason,
          metadata: { title: product.title, slug: product.slug, shopId: product.shopId },
        },
        tx
      );
      await tx.product.delete({ where: { id: parsedProductId.data } });
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
    revalidatePath('/admin', 'layout');

    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'An unexpected error occurred' };
  }
}

export async function updateUserRoleAction(userId: string, role: Role, reason?: string) {
  try {
    const parsedUserId = IdParamSchema.safeParse(userId);
    if (!parsedUserId.success) {
      return { error: 'Invalid user ID format' };
    }

    const parsedRole = RoleSchema.safeParse(role);
    if (!parsedRole.success) {
      return { error: 'Invalid role' };
    }

    const { actorId } = await verifyAdminAuth();

    const target = await db.user.findUnique({
      where: { id: parsedUserId.data },
      select: { id: true, role: true, email: true, name: true },
    });
    if (!target) return { error: 'User not found' };
    if (target.role === parsedRole.data) return { success: true };

    const grantingAdmin = parsedRole.data === Role.ADMIN;
    const revokingAdmin = target.role === Role.ADMIN && parsedRole.data !== Role.ADMIN;

    // You cannot demote yourself. With a single admin account this locked
    // everyone out of the admin surface permanently, with no way back that did
    // not involve a direct database write.
    if (revokingAdmin && target.id === actorId) {
      return {
        error:
          'You cannot remove your own admin access. Ask another admin to do it, so there is always someone who can get in.',
      };
    }

    // Nor demote the last one, for the same reason by a different route.
    if (revokingAdmin) {
      const admins = await db.user.count({ where: { role: Role.ADMIN } });
      if (admins <= 1) {
        return {
          error: 'That is the only admin account. Promote someone else first.',
        };
      }
    }

    // Privilege changes are the ones worth explaining. Granting admin without
    // a stated reason is exactly what an attacker with a stolen session would
    // do, and requiring a reason is what makes the audit row worth reading.
    if ((grantingAdmin || revokingAdmin) && !reason?.trim()) {
      return { error: 'Say why this person\'s admin access is changing.' };
    }

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: parsedUserId.data },
        data: { role: parsedRole.data },
      });
      await recordAdminAction(
        {
          actorId,
          action: grantingAdmin
            ? ADMIN_ACTIONS.GRANT_ADMIN
            : revokingAdmin
              ? ADMIN_ACTIONS.REVOKE_ADMIN
              : ADMIN_ACTIONS.CHANGE_ROLE,
          targetType: 'User',
          targetId: target.id,
          reason,
          metadata: { from: target.role, to: parsedRole.data, email: target.email },
        },
        tx
      );
    });

    // Every existing admin is told when someone gains admin. A compromised
    // session can still create a second admin, but it can no longer do it
    // quietly, which is the property that actually matters at this size.
    if (grantingAdmin) {
      const admins = await db.user.findMany({
        where: { role: Role.ADMIN, email: { not: null } },
        select: { email: true },
      });
      for (const a of admins) {
        if (!a.email) continue;
        notify({
          to: a.email,
          subject: 'A new admin was added to Seyon',
          text:
            `${target.name ?? target.email ?? 'A user'} was granted admin access.\n\n` +
            `Reason given: ${reason}\n\n` +
            'If you did not expect this, treat it as a compromised account and revoke it now.',
        }).catch(() => undefined);
      }
    }

    revalidatePath('/admin', 'layout'); // covers /admin/stores and /admin/stores/[slug]
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'An unexpected error occurred' };
  }
}
