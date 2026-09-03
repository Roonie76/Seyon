'use server';

import { z } from 'zod';
import { slugClashReason, retireSlug } from '../lib/shop-slug';
import { db } from '@/lib/db';
import { Prisma, KycStatus } from '@prisma/client';
import { isCurrentUserAdmin } from '../lib/is-admin';
import { toUserMessage } from '../lib/action-errors';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { auditTrailFor, recordAdminAction, ADMIN_ACTIONS, type AuditEntry } from '../lib/admin-audit';
import { requireAdmin } from '../lib/require-admin';
import { revalidateShopSurface, revalidateMarketplace } from '@/shared/lib/cache';
import { parsePage } from '@/shared/lib/search-params';

/**
 * Finding a store, and everything about it.
 *
 * Replaces `getAdminDashboardStats()` returning `allStores` — every store in
 * the marketplace, loaded into the page on every render. Fine at ten stores. At
 * a few thousand it is a slow page; at ten thousand it is a dead one, and the
 * failure arrives exactly when the marketplace starts working.
 *
 * Search covers the things an admin actually types: store name, slug, the
 * owner's name or email, and the WhatsApp number — because when a buyer
 * complains they usually have the number, not the slug.
 */

const PAGE_SIZE = 20;

const SearchSchema = z.object({
  query: z.string().trim().max(120).optional(),
  status: z
    .enum(['all', 'listed', 'unlisted', 'suspended', 'under_review', 'verified', 'unverified'])
    .optional(),
  page: z.string().optional(),
});

export interface AdminStoreRow {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  isListed: boolean;
  isVerified: boolean;
  isSuspended: boolean;
  isPaused: boolean;
  isUnderReview: boolean;
  underReviewReason: string | null;
  underReviewSince: Date | null;
  whatsapp: string;
  createdAt: Date;
  productCount: number;
  reviewCount: number;
  averageRating: number;
  openReports: number;
  ownerName: string | null;
  ownerEmail: string | null;
  kycStatus: KycStatus | null;
  legalName: string | null;
}

export interface AdminStoreSearchResult {
  rows: AdminStoreRow[];
  total: number;
  page: number;
  pageCount: number;
}

export async function searchStores(
  raw: unknown
): Promise<{ data: AdminStoreSearchResult } | { error: string }> {
  try {
    if (!(await isCurrentUserAdmin())) return { error: 'Not authorised.' };

    const parsed = SearchSchema.safeParse(raw ?? {});
    if (!parsed.success) return { error: 'Invalid search.' };
    const { query, status = 'all' } = parsed.data;
    const page = parsePage(parsed.data.page);

    const filters: Prisma.ShopWhereInput[] = [];

    if (query) {
      // pg_trgm is already installed for product search, so these ILIKEs are
      // indexed rather than sequential scans.
      filters.push({
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { slug: { contains: query, mode: 'insensitive' } },
          { whatsapp: { contains: query.replace(/[^\d]/g, '') || query } },
          { owner: { email: { contains: query, mode: 'insensitive' } } },
          { owner: { name: { contains: query, mode: 'insensitive' } } },
        ],
      });
    }

    switch (status) {
      case 'listed': filters.push({ isListed: true }); break;
      case 'unlisted': filters.push({ isListed: false }); break;
      case 'suspended': filters.push({ isSuspended: true }); break;
      case 'under_review': filters.push({ isUnderReview: true }); break;
      case 'verified': filters.push({ isVerified: true }); break;
      case 'unverified': filters.push({ isVerified: false }); break;
      default: break;
    }

    const where: Prisma.ShopWhereInput = filters.length ? { AND: filters } : {};

    const [total, shops] = await Promise.all([
      db.shop.count({ where }),
      db.shop.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          _count: { select: { products: true, reviews: true } },
          owner: {
            select: {
              name: true,
              email: true,
              sellerKyc: { select: { status: true, legalName: true } },
            },
          },
          reports: { where: { status: 'OPEN' }, select: { id: true } },
        },
      }),
    ]);

    return {
      data: {
        rows: shops.map((s) => ({
          id: s.id,
          name: s.name,
          slug: s.slug,
          city: s.city,
          isListed: s.isListed,
          isVerified: s.isVerified,
          isSuspended: s.isSuspended,
          isPaused: s.isPaused,
          isUnderReview: s.isUnderReview,
          underReviewReason: s.underReviewReason,
          underReviewSince: s.underReviewSince,
          whatsapp: s.whatsapp,
          createdAt: s.createdAt,
          productCount: s._count.products,
          reviewCount: s._count.reviews,
          averageRating: s.averageRating,
          openReports: s.reports.length,
          ownerName: s.owner.name,
          ownerEmail: s.owner.email,
          kycStatus: s.owner.sellerKyc?.status ?? null,
          legalName: s.owner.sellerKyc?.legalName ?? null,
        })),
        total,
        page,
        pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      },
    };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'searchStores' }) };
  }
}

export interface AdminStoreDetail extends AdminStoreRow {
  description: string | null;
  region: string | null;
  ownerPhone: string | null;
  ownerAddress: string | null;
  ownerJoinedAt: Date;
  products: { id: string; title: string; slug: string; price: number; status: string }[];
  reports: { id: string; reason: string; status: string; createdAt: Date }[];
  audit: AuditEntry[];
}

/** Everything about one store, on one screen. */
export async function getStoreDetail(
  slug: string
): Promise<{ data: AdminStoreDetail } | { error: string }> {
  try {
    if (!(await isCurrentUserAdmin())) return { error: 'Not authorised.' };

    const clean = String(slug ?? '').trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(clean)) return { error: 'Invalid store address.' };

    const shop = await db.shop.findUnique({
      where: { slug: clean },
      include: {
        _count: { select: { products: true, reviews: true } },
        owner: {
          select: {
            name: true, email: true, phone: true, createdAt: true,
            addressLine1: true, addressLine2: true, city: true, state: true, postalCode: true,
            sellerKyc: { select: { status: true, legalName: true } },
          },
        },
        products: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, title: true, slug: true, price: true, status: true },
        },
        reports: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: { id: true, reason: true, status: true, createdAt: true },
        },
      },
    });

    if (!shop) return { error: 'Store not found.' };

    const audit = await auditTrailFor('Shop', shop.id);

    return {
      data: {
        id: shop.id,
        name: shop.name,
        slug: shop.slug,
        description: shop.description,
        city: shop.city,
        region: shop.region,
        isListed: shop.isListed,
        isVerified: shop.isVerified,
        isSuspended: shop.isSuspended,
        isPaused: shop.isPaused,
        isUnderReview: shop.isUnderReview,
        underReviewReason: shop.underReviewReason,
        underReviewSince: shop.underReviewSince,
        whatsapp: shop.whatsapp,
        createdAt: shop.createdAt,
        productCount: shop._count.products,
        reviewCount: shop._count.reviews,
        averageRating: shop.averageRating,
        openReports: shop.reports.filter((r) => r.status === 'OPEN').length,
        ownerName: shop.owner.name,
        ownerEmail: shop.owner.email,
        ownerPhone: shop.owner.phone,
        ownerAddress:
          [shop.owner.addressLine1, shop.owner.addressLine2, shop.owner.city, shop.owner.state, shop.owner.postalCode]
            .filter(Boolean)
            .join(', ') || null,
        ownerJoinedAt: shop.owner.createdAt,
        kycStatus: shop.owner.sellerKyc?.status ?? null,
        legalName: shop.owner.sellerKyc?.legalName ?? null,
        products: shop.products,
        reports: shop.reports,
        audit,
      },
    };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'getStoreDetail' }) };
  }
}

/* ------------------------------------------------------------ bulk actions */

const BulkSchema = z.object({
  shopIds: z.array(z.string().cuid()).min(1, 'Select at least one store.').max(50, 'Fifty stores at a time.'),
  action: z.enum(['VERIFY', 'UNVERIFY', 'MARK_UNDER_REVIEW', 'CLEAR_UNDER_REVIEW']),
  reason: z.string().trim().max(1000).optional(),
});

/**
 * Apply one reversible action to several stores.
 *
 * Deliberately not bulk suspend and not bulk delete. Both take something away
 * from a seller, both are the actions a mistake is most expensive on, and both
 * should cost an admin the effort of doing them one at a time — the friction is
 * the feature. Verifying and marking under review are reversible with one
 * click, which is what makes them safe in a batch.
 *
 * Each store still gets its own audit row. A single row listing forty ids would
 * be unreadable on any of those forty stores' history pages, which is where
 * anyone actually looks.
 */
export async function bulkStoreAction(raw: unknown) {
  try {
    const parsed = BulkSchema.safeParse(raw);
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { shopIds, action, reason } = parsed.data;

    const { actorId } = await requireAdmin();

    if (action === 'MARK_UNDER_REVIEW' && !reason?.trim()) {
      return { error: 'Say why these stores are being looked at. It goes in each one\'s record.' };
    }

    const shops = await db.shop.findMany({
      where: { id: { in: shopIds } },
      select: { id: true, slug: true },
    });
    if (shops.length === 0) return { error: 'None of those stores exist.' };

    const data =
      action === 'VERIFY' ? { isVerified: true }
      : action === 'UNVERIFY' ? { isVerified: false }
      : action === 'MARK_UNDER_REVIEW' ? { isUnderReview: true, underReviewSince: new Date() }
      : { isUnderReview: false, underReviewSince: null };

    const auditAction =
      action === 'VERIFY' ? ADMIN_ACTIONS.VERIFY_SHOP
      : action === 'UNVERIFY' ? ADMIN_ACTIONS.UNVERIFY_SHOP
      : action === 'MARK_UNDER_REVIEW' ? ADMIN_ACTIONS.MARK_UNDER_REVIEW
      : ADMIN_ACTIONS.CLEAR_UNDER_REVIEW;

    // One id shared by every row, so a batch can be told apart from forty
    // people independently reaching the same conclusion.
    const correlationId = randomUUID();

    await db.$transaction(async (tx) => {
      await tx.shop.updateMany({ where: { id: { in: shops.map((s) => s.id) } }, data });
      for (const shop of shops) {
        await recordAdminAction(
          {
            actorId,
            action: auditAction,
            targetType: 'Shop',
            targetId: shop.id,
            reason: reason?.trim() || null,
            metadata: { slug: shop.slug, bulk: true, batchSize: shops.length, correlationId },
          },
          tx
        );
      }
    });

    for (const shop of shops) revalidateShopSurface(shop.slug);
    revalidateMarketplace();
    revalidatePath('/admin', 'layout');

    return { success: true, count: shops.length };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'bulkStoreAction' }) };
  }
}

/* ------------------------------------------------------------ store repair */

const RepairSchema = z.object({
  shopId: z.string().cuid(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens.')
    .min(3, 'At least three characters.')
    .max(60, 'At most sixty characters.')
    .optional(),
  whatsapp: z
    .string()
    .trim()
    .regex(/^\d{10,15}$/, 'Digits only, including the country code.')
    .optional(),
  reason: z.string().trim().min(10, 'Say what was wrong with it.').max(1000),
});

/**
 * Fix a store's address or contact number.
 *
 * The slug is the sharp edge. Changing it breaks every link the seller has
 * shared, every search result and every WhatsApp message pointing at the old
 * one — so the old address is kept in `ShopSlugHistory` and the storefront
 * redirects, rather than the marketplace quietly losing that traffic. The old
 * slug is never freed for reuse either: handing it to a different store would
 * redirect one seller's audience to another's.
 */
export async function repairStoreAction(raw: unknown) {
  try {
    const parsed = RepairSchema.safeParse(raw);
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { shopId, slug, whatsapp, reason } = parsed.data;

    if (!slug && !whatsapp) return { error: 'Nothing to change.' };

    const { actorId } = await requireAdmin();

    const shop = await db.shop.findUnique({
      where: { id: shopId },
      select: { id: true, slug: true, whatsapp: true, name: true },
    });
    if (!shop) return { error: 'Store not found.' };

    const slugChanged = Boolean(slug && slug !== shop.slug);

    if (slugChanged) {
      // Taken by a live store, or reserved by another store's history. The same
      // helper the seller's own rename uses — the two disagreed for a long time,
      // and the seller's half was the one that was wrong.
      const clash = await slugClashReason(slug!, shop.id);
      if (clash) return { error: clash };
    }

    await db.$transaction(async (tx) => {
      if (slugChanged) {
        // Record the old address before taking it, so a crash between the two
        // cannot leave the store unreachable at either.
        await retireSlug(tx, shop.id, shop.slug, actorId);
      }

      await tx.shop.update({
        where: { id: shop.id },
        data: { ...(slugChanged ? { slug } : {}), ...(whatsapp ? { whatsapp } : {}) },
      });

      await recordAdminAction(
        {
          actorId,
          action: ADMIN_ACTIONS.REPAIR_SHOP,
          targetType: 'Shop',
          targetId: shop.id,
          reason,
          metadata: {
            name: shop.name,
            ...(slugChanged ? { slugFrom: shop.slug, slugTo: slug } : {}),
            ...(whatsapp && whatsapp !== shop.whatsapp
              ? { whatsappFrom: shop.whatsapp, whatsappTo: whatsapp }
              : {}),
          },
        },
        tx
      );
    });

    revalidateShopSurface(shop.slug);
    if (slug) revalidateShopSurface(slug);
    revalidateMarketplace();
    revalidatePath('/admin', 'layout');

    return { success: true, slug: slug ?? shop.slug };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'repairStore' }) };
  }
}
