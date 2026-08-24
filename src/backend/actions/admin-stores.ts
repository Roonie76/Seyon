'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { Prisma, KycStatus } from '@prisma/client';
import { isCurrentUserAdmin } from '../lib/is-admin';
import { toUserMessage } from '../lib/action-errors';
import { auditTrailFor, type AuditEntry } from '../lib/admin-audit';
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
