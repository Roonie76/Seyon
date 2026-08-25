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
import { roleAfterShopRemoval } from '@/shared/lib/shop-removal';
import { ACK_DEADLINE_HOURS } from '@/shared/lib/complaints';
import { issueNotice, emailNotice } from '../lib/notices';
import { setShopSuspendedInTx } from '../lib/moderation-ops';

const IdParamSchema = z.string().cuid('Invalid identifier format');
const RoleSchema = z.nativeEnum(Role);

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
      overdueComplaints,
      openComplaints,
    ] = await Promise.all([
      db.user.count({ where: { role: Role.SELLER } }),
      db.product.count(),
      db.shop.count(),
      // A preview, not a queue. /admin/reports is the queue, with the SLA
      // clocks and the actions; this is the ten oldest so the landing page can
      // say what is waiting. Oldest first, because a list sorted newest-first
      // is how the oldest complaint becomes the one nobody reaches.
      db.report.findMany({
        where: { status: { in: [ReportStatus.OPEN, ReportStatus.UNDER_REVIEW] } },
        include: { shop: { select: { name: true, slug: true } } },
        orderBy: { createdAt: 'asc' },
        take: 10,
      }),
      // Count signups in the last 24h
      db.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      // Past the 48-hour acknowledgement deadline and still unacknowledged.
      db.report.count({
        where: {
          acknowledgedAt: null,
          createdAt: { lt: new Date(Date.now() - ACK_DEADLINE_HOURS * 3_600_000) },
        },
      }),
      db.report.count({ where: { status: { in: [ReportStatus.OPEN, ReportStatus.UNDER_REVIEW] } } }),
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

    // The overdue flag is decided here, against one instant, rather than in the
    // page: calling Date.now() while rendering is both impure and gives each
    // row a slightly different clock.
    const ackCutoff = Date.now() - ACK_DEADLINE_HOURS * 3_600_000;
    const reportPreview = reports.map((r) => ({
      id: r.id,
      category: r.category,
      reason: r.reason,
      createdAt: r.createdAt,
      overdue: r.acknowledgedAt === null && r.createdAt.getTime() < ackCutoff,
      shopName: r.shop.name,
      shopSlug: r.shop.slug,
    }));

    return {
      success: true,
      stats: {
        totalSellers,
        totalProducts,
        totalStores,
        dailySignups,
        reportsCount: openComplaints,
        overdueComplaints,
      },
      reports: reportPreview,
      popularShops,
      popularProducts,
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

    const { shopSlug, noticeId } = await db.$transaction((tx) =>
      setShopSuspendedInTx(tx, { shopId: parsedShopId.data, isSuspended, reason }, { actorId })
    );

    // Email is the convenience copy; the notice above is the record.
    emailNotice(noticeId).catch(() => undefined);

    revalidateShopSurface(shopSlug);
    revalidatePath('/admin', 'layout'); // covers /admin/stores and /admin/stores/[slug]
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'An unexpected error occurred' };
  }
}

/**
 * `resolveReportAction` was removed.
 *
 * It set `status = 'RESOLVED'` and nothing else, which the
 * `Report_terminal_has_resolved_at` constraint rejects outright — a complaint
 * cannot reach a terminal state without a disposal timestamp, and it could not
 * be disposed of before it was acknowledged. Its only caller was the old
 * `AdminModeration` panel, which is gone too.
 *
 * Use `acknowledgeComplaintAction` and `closeComplaintAction` in
 * `actions/complaints.ts`: they stamp both timestamps, require a note that the
 * reporter is sent, and distinguish "we acted" from "we found nothing".
 */

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

const DeleteShopSchema = z.object({
  shopId: z.string().cuid('Invalid shop ID format'),
  reason: z
    .string()
    .trim()
    .min(10, 'Say why this store is being removed. It is destroying someone\'s business.')
    .max(2000, 'Keep the reason under 2000 characters.'),
  /** The store's slug, typed by the admin. */
  confirmSlug: z.string().trim().toLowerCase(),
});

/**
 * Remove a store permanently.
 *
 * `ADMIN_ACTIONS.DELETE_SHOP` and its database CHECK have existed since the
 * audit work; nothing ever called them, so a fraudulent store could be
 * suspended forever but never removed. Suspension is reversible by any admin,
 * and some stores should stop existing.
 *
 * Three things make this different from suspending.
 *
 * The audit row is written *first*, inside the transaction, with everything
 * worth keeping copied into `metadata`. Reviews, reports and notices all
 * cascade with the shop, so the record of what the seller was told dies with
 * the store — `AdminAction` does not cascade, and is the only thing that
 * survives to answer "why is this store gone".
 *
 * It asks for the slug as well as a reason. A reason alone is the same gesture
 * as suspending, and those two controls sit next to each other.
 *
 * The owner is emailed rather than sent a Notice, because a Notice row would be
 * deleted by the same cascade a moment after being written.
 */
export async function deleteShopAsAdmin(raw: unknown) {
  try {
    const parsed = DeleteShopSchema.safeParse(raw);
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { shopId, reason, confirmSlug } = parsed.data;

    const { actorId } = await verifyAdminAuth();

    const shop = await db.shop.findUnique({
      where: { id: shopId },
      include: {
        owner: { select: { id: true, email: true, name: true, role: true } },
        products: { include: { images: { select: { url: true } } } },
        _count: { select: { products: true, reviews: true, reports: true, notices: true } },
      },
    });
    if (!shop) return { error: 'Store not found.' };

    if (confirmSlug !== shop.slug) {
      return { error: `Type the store address exactly — "${shop.slug}" — to confirm.` };
    }

    const imageUrls = shop.products.flatMap((p) => p.images.map((img) => img.url));

    await db.$transaction(async (tx) => {
      // First, and in the same transaction: everything below is about to be
      // unrecoverable, and this row is the only thing that will still exist.
      await recordAdminAction(
        {
          actorId,
          action: ADMIN_ACTIONS.DELETE_SHOP,
          targetType: 'Shop',
          targetId: shop.id,
          reason,
          metadata: {
            name: shop.name,
            slug: shop.slug,
            city: shop.city,
            whatsapp: shop.whatsapp,
            ownerId: shop.owner.id,
            ownerEmail: shop.owner.email,
            createdAt: shop.createdAt.toISOString(),
            wasVerified: shop.isVerified,
            wasSuspended: shop.isSuspended,
            wasUnderReview: shop.isUnderReview,
            productCount: shop._count.products,
            reviewCount: shop._count.reviews,
            reportCount: shop._count.reports,
            noticeCount: shop._count.notices,
          },
        },
        tx
      );

      await tx.shop.delete({ where: { id: shop.id } });

      // Hand back the buyer role so the seller dashboard stops half-working.
      // Only from SELLER — see roleAfterShopRemoval for why that matters.
      const nextRole = roleAfterShopRemoval(shop.owner.role);
      if (nextRole) {
        await tx.user.update({ where: { id: shop.owner.id }, data: { role: nextRole } });
      }
    });

    // Storage cleanup only after the delete has committed, so a failed
    // transaction cannot leave a live store pointing at removed files.
    const prefix = storagePrefixForShop(shop.id);
    for (const url of imageUrls) {
      try { await deleteFile(url, 'products', prefix); } catch { /* orphans are acceptable */ }
    }
    if (shop.logo) { try { await deleteFile(shop.logo, 'logos', prefix); } catch { /* best-effort */ } }
    if (shop.banner) { try { await deleteFile(shop.banner, 'banners', prefix); } catch { /* best-effort */ } }

    if (shop.owner.email) {
      notify({
        to: shop.owner.email,
        subject: `Your storefront "${shop.name}" has been removed from Seyon`,
        text:
          `Your storefront "${shop.name}" has been removed from Seyon by a moderator, along with its ${shop._count.products} listing(s).\n\n` +
          `Reason given:\n${reason}\n\n` +
          'This cannot be undone from your side. If you believe it is a mistake, reply to this email.',
      }).catch(() => undefined);
    }

    revalidateShopSurface(shop.slug);
    revalidateMarketplace();
    revalidatePath('/admin', 'layout');

    logger.info('Storefront deleted by admin', { shopId: shop.id, slug: shop.slug, actorId });
    return { success: true, slug: shop.slug };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'An unexpected error occurred' };
  }
}
