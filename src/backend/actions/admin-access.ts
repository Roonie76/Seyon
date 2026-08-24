'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { Role, KycStatus } from '@prisma/client';
import { requireAdmin } from '../lib/require-admin';
import { auditTrailFor, type AuditEntry } from '../lib/admin-audit';
import { toUserMessage } from '../lib/action-errors';
import { parsePage } from '@/shared/lib/search-params';

/**
 * Who can do things, and who changed that.
 *
 * `updateUserRoleAction` has had all the right guards for a while — no
 * self-demotion, no demoting the last admin, a reason required for privilege
 * changes, every existing admin emailed when someone gains admin, and an audit
 * row written in the same transaction as the change. None of it ever ran,
 * because there was no screen that called it: the only way to make someone an
 * admin was to edit the row by hand, which skips every one of those guards and
 * writes no audit row at all.
 *
 * This file is the read side of the screen that fixes that.
 */

const PAGE_SIZE = 20;

const SearchSchema = z.object({
  query: z.string().trim().max(120).optional(),
  role: z.nativeEnum(Role).optional(),
  page: z.string().optional(),
});

export interface AccountRow {
  id: string;
  name: string | null;
  email: string | null;
  role: Role;
  createdAt: Date;
  hasShop: boolean;
  shopSlug: string | null;
  isSelf: boolean;
}

export interface AccessOverview {
  rows: AccountRow[];
  total: number;
  page: number;
  pageCount: number;
  adminCount: number;
  /** History of every role change, regardless of target. */
  recentChanges: AuditEntry[];
}

export async function getAccessOverview(
  raw: unknown
): Promise<{ data: AccessOverview } | { error: string }> {
  try {
    const { actorId } = await requireAdmin();

    const parsed = SearchSchema.safeParse(raw ?? {});
    if (!parsed.success) return { error: 'Invalid search.' };
    const { query, role } = parsed.data;
    const page = parsePage(parsed.data.page);

    const where = {
      ...(role ? { role } : {}),
      ...(query
        ? {
            OR: [
              { email: { contains: query, mode: 'insensitive' as const } },
              { name: { contains: query, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [total, users, adminCount, changes] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where,
        // Admins first, so the list of people who can do damage is the list you
        // see without scrolling.
        orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true, name: true, email: true, role: true, createdAt: true,
          shop: { select: { slug: true } },
        },
      }),
      db.user.count({ where: { role: Role.ADMIN } }),
      db.adminAction.findMany({
        where: { action: { in: ['GRANT_ADMIN', 'REVOKE_ADMIN', 'CHANGE_ROLE'] } },
        orderBy: { createdAt: 'desc' },
        take: 25,
        include: { actor: { select: { name: true, email: true } } },
      }),
    ]);

    return {
      data: {
        rows: users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          createdAt: u.createdAt,
          hasShop: Boolean(u.shop),
          shopSlug: u.shop?.slug ?? null,
          isSelf: u.id === actorId,
        })),
        total,
        page,
        pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
        adminCount,
        recentChanges: changes.map((c) => ({
          id: c.id,
          action: c.action,
          targetType: c.targetType,
          targetId: c.targetId,
          reason: c.reason,
          createdAt: c.createdAt,
          actorName: c.actor.name,
          actorEmail: c.actor.email,
        })),
      },
    };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'getAccessOverview' }) };
  }
}

/** Role-change history for one account. */
export async function getAccountAudit(userId: string): Promise<{ data: AuditEntry[] } | { error: string }> {
  try {
    await requireAdmin();
    const id = z.string().cuid().safeParse(userId);
    if (!id.success) return { error: 'Invalid user id.' };
    return { data: await auditTrailFor('User', id.data) };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'getAccountAudit' }) };
  }
}

export interface AccountDetail {
  id: string;
  name: string | null;
  email: string | null;
  role: Role;
  createdAt: Date;
  phone: string | null;
  isSelf: boolean;
  /** True while this is the only ADMIN — the account that cannot be demoted. */
  isOnlyAdmin: boolean;
  shop: { name: string; slug: string; isSuspended: boolean; isUnderReview: boolean } | null;
  kycStatus: KycStatus | null;
  reviewCount: number;
  reportCount: number;
  audit: AuditEntry[];
}

/**
 * One account, and how it came to have the role it has.
 *
 * The overview lists who is an admin. It cannot say who made them one, when, or
 * what reason was given — which is the only part that matters when an admin
 * account turns up that nobody remembers creating.
 */
export async function getAccountDetail(
  userId: string
): Promise<{ data: AccountDetail } | { error: string }> {
  try {
    const { actorId } = await requireAdmin();

    const id = z.string().cuid().safeParse(userId);
    if (!id.success) return { error: 'Invalid user id.' };

    const user = await db.user.findUnique({
      where: { id: id.data },
      select: {
        id: true, name: true, email: true, role: true, createdAt: true, phone: true,
        shop: { select: { name: true, slug: true, isSuspended: true, isUnderReview: true } },
        sellerKyc: { select: { status: true } },
        _count: { select: { reviews: true, reports: true } },
      },
    });
    if (!user) return { error: 'Account not found.' };

    // Reuses the existing history query rather than repeating it, so the two
    // can never disagree about what counts as this account's history.
    const auditRes = await getAccountAudit(user.id);
    const audit = 'data' in auditRes ? auditRes.data : [];

    const adminCount = user.role === Role.ADMIN ? await db.user.count({ where: { role: Role.ADMIN } }) : 0;

    return {
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        phone: user.phone,
        isSelf: user.id === actorId,
        isOnlyAdmin: user.role === Role.ADMIN && adminCount <= 1,
        shop: user.shop,
        kycStatus: user.sellerKyc?.status ?? null,
        reviewCount: user._count.reviews,
        reportCount: user._count.reports,
        audit,
      },
    };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'getAccountDetail' }) };
  }
}
