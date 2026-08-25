'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { Prisma, ReportCategory, ReportStatus, ReportTarget } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '../lib/require-admin';
import { recordAdminAction, ADMIN_ACTIONS, auditTrailFor, type AuditEntry } from '../lib/admin-audit';
import { toUserMessage } from '../lib/action-errors';
import { notify } from '../lib/notify';
import { complaintSla, isSevere, type ComplaintSla } from '@/shared/lib/complaints';
import { parsePage } from '@/shared/lib/search-params';
import { revalidateShopSurface } from '@/shared/lib/cache';

/**
 * The complaints queue, and the clock it runs against.
 *
 * Before this, a report had a status and a creation date and nothing else. The
 * question the Consumer Protection (E-Commerce) Rules 2020 actually ask —
 * "was this acknowledged within forty-eight hours, and disposed of within a
 * month" — could not be answered from the data at all. Acknowledgement is now
 * a separate, recorded step from disposal, because in the rules they are
 * separate obligations with separate deadlines.
 */

const PAGE_SIZE = 25;
const IdSchema = z.string().cuid('Invalid identifier');

const QueueSchema = z.object({
  status: z.enum(['open', 'acknowledged', 'overdue', 'closed', 'all']).optional(),
  category: z.nativeEnum(ReportCategory).optional(),
  /** Complaints about the store itself, or about one of its reviews. */
  target: z.nativeEnum(ReportTarget).optional(),
  page: z.string().optional(),
});

type Result = { success: true; error?: undefined } | { success?: undefined; error: string };

/** The review a complaint is about, when it is about one. */
export interface ComplaintReviewTarget {
  id: string;
  rating: number;
  comment: string;
  createdAt: Date;
  isHidden: boolean;
  authorName: string | null;
}

export interface ComplaintRow {
  id: string;
  targetType: ReportTarget;
  review: ComplaintReviewTarget | null;
  category: ReportCategory;
  reason: string;
  status: ReportStatus;
  createdAt: Date;
  acknowledgedAt: Date | null;
  acknowledgedByName: string | null;
  resolvedAt: Date | null;
  resolutionNote: string | null;
  reporterName: string | null;
  reporterEmail: string | null;
  shopName: string;
  shopSlug: string;
  shopId: string;
  shopIsSuspended: boolean;
  shopIsUnderReview: boolean;
  /** Other open complaints against the same store — one report is noise, five is a pattern. */
  siblingOpenCount: number;
  severe: boolean;
  sla: ComplaintSla;
}

export interface ComplaintQueue {
  rows: ComplaintRow[];
  total: number;
  page: number;
  pageCount: number;
  counts: { open: number; overdueAck: number; overdueResolve: number };
}

export async function getComplaintQueue(
  raw: unknown
): Promise<{ data: ComplaintQueue } | { error: string }> {
  try {
    await requireAdmin();

    const parsed = QueueSchema.safeParse(raw ?? {});
    if (!parsed.success) return { error: 'Invalid filter.' };
    const { status = 'open', category, target } = parsed.data;
    const page = parsePage(parsed.data.page);

    const now = new Date();
    const ackCutoff = new Date(now.getTime() - 48 * 3_600_000);

    const filters: Prisma.ReportWhereInput[] = [];
    if (category) filters.push({ category });
    if (target) filters.push({ targetType: target });

    switch (status) {
      case 'open':
        filters.push({ status: { in: [ReportStatus.OPEN, ReportStatus.UNDER_REVIEW] } });
        break;
      case 'acknowledged':
        filters.push({ acknowledgedAt: { not: null }, resolvedAt: null });
        break;
      case 'overdue':
        // Past the 48-hour mark and still unacknowledged. This is the list that
        // matters if anyone ever asks how the marketplace handles complaints.
        filters.push({ acknowledgedAt: null, createdAt: { lt: ackCutoff } });
        break;
      case 'closed':
        filters.push({ status: { in: [ReportStatus.RESOLVED, ReportStatus.REJECTED] } });
        break;
      default:
        break;
    }

    const where: Prisma.ReportWhereInput = filters.length ? { AND: filters } : {};

    const [total, rows, open, overdueAck, overdueResolve] = await Promise.all([
      db.report.count({ where }),
      db.report.findMany({
        where,
        // Oldest first: a queue sorted newest-first is how the oldest complaint
        // becomes the one nobody ever reaches.
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          user: { select: { name: true, email: true } },
          acknowledgedBy: { select: { name: true } },
          shop: { select: { id: true, name: true, slug: true, isSuspended: true, isUnderReview: true } },
          review: {
            select: {
              id: true, rating: true, comment: true, createdAt: true, isHidden: true,
              user: { select: { name: true } },
            },
          },
        },
      }),
      db.report.count({ where: { status: { in: [ReportStatus.OPEN, ReportStatus.UNDER_REVIEW] } } }),
      db.report.count({ where: { acknowledgedAt: null, createdAt: { lt: ackCutoff } } }),
      db.report.count({
        where: {
          resolvedAt: null,
          createdAt: { lt: new Date(now.getTime() - 30 * 86_400_000) },
        },
      }),
    ]);

    // One grouped query rather than a count per row.
    const shopIds = [...new Set(rows.map((r) => r.shopId))];
    const siblings = shopIds.length
      ? await db.report.groupBy({
          by: ['shopId'],
          where: { shopId: { in: shopIds }, status: { in: [ReportStatus.OPEN, ReportStatus.UNDER_REVIEW] } },
          _count: { _all: true },
        })
      : [];
    const siblingCount = new Map(siblings.map((s) => [s.shopId, s._count._all]));

    return {
      data: {
        rows: rows.map((r) => ({
          id: r.id,
          targetType: r.targetType,
          review: r.review
            ? {
                id: r.review.id,
                rating: r.review.rating,
                comment: r.review.comment,
                createdAt: r.review.createdAt,
                isHidden: r.review.isHidden,
                authorName: r.review.user?.name ?? null,
              }
            : null,
          category: r.category,
          reason: r.reason,
          status: r.status,
          createdAt: r.createdAt,
          acknowledgedAt: r.acknowledgedAt,
          acknowledgedByName: r.acknowledgedBy?.name ?? null,
          resolvedAt: r.resolvedAt,
          resolutionNote: r.resolutionNote,
          reporterName: r.user?.name ?? null,
          reporterEmail: r.user?.email ?? null,
          shopId: r.shop.id,
          shopName: r.shop.name,
          shopSlug: r.shop.slug,
          shopIsSuspended: r.shop.isSuspended,
          shopIsUnderReview: r.shop.isUnderReview,
          siblingOpenCount: siblingCount.get(r.shopId) ?? 0,
          severe: isSevere(r.category),
          sla: complaintSla(r, now),
        })),
        total,
        page,
        pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
        counts: { open, overdueAck, overdueResolve },
      },
    };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'getComplaintQueue' }) };
  }
}

/**
 * Acknowledge a complaint.
 *
 * Separate from resolving it on purpose. Acknowledgement is the forty-eight
 * hour obligation and says only "a person has seen this"; resolution is the
 * one-month obligation and says what was done. Rolling them together would
 * make it impossible to be on time for the first while still working on the
 * second, which is the normal case for anything non-trivial.
 */
export async function acknowledgeComplaintAction(reportId: string): Promise<Result> {
  try {
    const id = IdSchema.safeParse(reportId);
    if (!id.success) return { error: 'Invalid report id.' };

    const { actorId } = await requireAdmin();

    const report = await db.report.findUnique({
      where: { id: id.data },
      select: {
        id: true, acknowledgedAt: true, createdAt: true, category: true,
        user: { select: { email: true } },
        shop: { select: { name: true, slug: true } },
      },
    });
    if (!report) return { error: 'Report not found.' };
    if (report.acknowledgedAt) return { success: true };

    const now = new Date();

    await db.$transaction(async (tx) => {
      await tx.report.update({
        where: { id: report.id },
        data: {
          acknowledgedAt: now,
          acknowledgedById: actorId,
          status: ReportStatus.UNDER_REVIEW,
        },
      });
      await recordAdminAction(
        {
          actorId,
          action: ADMIN_ACTIONS.ACKNOWLEDGE_REPORT,
          targetType: 'Report',
          targetId: report.id,
          metadata: {
            shopSlug: report.shop.slug,
            category: report.category,
            hoursAfterReceipt: Math.round((now.getTime() - report.createdAt.getTime()) / 3_600_000),
          },
        },
        tx
      );
    });

    if (report.user?.email) {
      notify({
        to: report.user.email,
        subject: `We have your report about "${report.shop.name}"`,
        text:
          `Thanks for reporting this. Someone on the Seyon moderation team has your complaint about the storefront "${report.shop.name}" and is looking into it.\n\n` +
          'We will write again when it is closed.',
      }).catch(() => undefined);
    }

    revalidatePath('/admin', 'layout');
    return { success: true };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'acknowledgeComplaint' }) };
  }
}

const NoteSchema = z
  .string()
  .trim()
  .min(10, 'Say what was done about it — the person who reported it is told this.')
  .max(2000, 'Keep the note under 2000 characters.');

/**
 * Close a complaint, either way.
 *
 * `REJECTED` exists so that "we looked and there was nothing wrong" is
 * recordable. Folding it into RESOLVED would leave a seller with a permanent
 * count of resolved complaints against them that nobody could distinguish from
 * upheld ones.
 */
export async function closeComplaintAction(
  reportId: string,
  outcome: 'RESOLVED' | 'REJECTED',
  note: string
): Promise<Result> {
  try {
    const id = IdSchema.safeParse(reportId);
    if (!id.success) return { error: 'Invalid report id.' };

    if (outcome !== 'RESOLVED' && outcome !== 'REJECTED') return { error: 'Invalid outcome.' };

    const parsedNote = NoteSchema.safeParse(note);
    if (!parsedNote.success) return { error: parsedNote.error.issues[0].message };

    const { actorId } = await requireAdmin();

    const report = await db.report.findUnique({
      where: { id: id.data },
      select: {
        id: true, acknowledgedAt: true, createdAt: true, resolvedAt: true, category: true,
        user: { select: { email: true } },
        shop: { select: { name: true, slug: true } },
      },
    });
    if (!report) return { error: 'Report not found.' };
    if (report.resolvedAt) return { error: 'This complaint is already closed.' };

    const now = new Date();

    await db.$transaction(async (tx) => {
      await tx.report.update({
        where: { id: report.id },
        data: {
          status: outcome === 'RESOLVED' ? ReportStatus.RESOLVED : ReportStatus.REJECTED,
          resolvedAt: now,
          resolutionNote: parsedNote.data,
          // The database refuses a disposal that was never acknowledged. Closing
          // something the same hour it arrived is legitimate — stamp the
          // acknowledgement rather than failing the close.
          ...(report.acknowledgedAt ? {} : { acknowledgedAt: now, acknowledgedById: actorId }),
        },
      });
      await recordAdminAction(
        {
          actorId,
          action: outcome === 'RESOLVED' ? ADMIN_ACTIONS.RESOLVE_REPORT : ADMIN_ACTIONS.REJECT_REPORT,
          targetType: 'Report',
          targetId: report.id,
          // REJECT_REPORT requires a reason, in the code and in the database.
          reason: outcome === 'REJECTED' ? parsedNote.data : null,
          metadata: {
            shopSlug: report.shop.slug,
            category: report.category,
            daysAfterReceipt: Math.round((now.getTime() - report.createdAt.getTime()) / 86_400_000),
          },
        },
        tx
      );
    });

    if (report.user?.email) {
      notify({
        to: report.user.email,
        subject: `Your report about "${report.shop.name}" is closed`,
        text:
          outcome === 'RESOLVED'
            ? `Your report about the storefront "${report.shop.name}" has been reviewed and acted on.\n\nWhat happened:\n${parsedNote.data}`
            : `Your report about the storefront "${report.shop.name}" has been reviewed. We did not find a breach of our policies.\n\nWhy:\n${parsedNote.data}\n\nIf you have more information, report it again and it will be looked at fresh.`,
      }).catch(() => undefined);
    }

    revalidateShopSurface(report.shop.slug);
    revalidatePath('/admin', 'layout');
    return { success: true };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'closeComplaint' }) };
  }
}

export interface ComplaintDetail extends ComplaintRow {
  audit: AuditEntry[];
  shopOpenComplaints: { id: string; category: ReportCategory; reason: string; createdAt: Date; status: ReportStatus }[];
}

export async function getComplaint(
  reportId: string
): Promise<{ data: ComplaintDetail } | { error: string }> {
  try {
    await requireAdmin();

    const id = IdSchema.safeParse(reportId);
    if (!id.success) return { error: 'Invalid report id.' };

    const r = await db.report.findUnique({
      where: { id: id.data },
      include: {
        user: { select: { name: true, email: true } },
        acknowledgedBy: { select: { name: true } },
        shop: { select: { id: true, name: true, slug: true, isSuspended: true, isUnderReview: true } },
        review: {
          select: {
            id: true, rating: true, comment: true, createdAt: true, isHidden: true,
            user: { select: { name: true } },
          },
        },
      },
    });
    if (!r) return { error: 'Report not found.' };

    const [audit, others] = await Promise.all([
      auditTrailFor('Report', r.id),
      db.report.findMany({
        where: { shopId: r.shopId, id: { not: r.id } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, category: true, reason: true, createdAt: true, status: true },
      }),
    ]);

    const now = new Date();
    const openSiblings = others.filter(
      (o) => o.status === ReportStatus.OPEN || o.status === ReportStatus.UNDER_REVIEW
    ).length;

    return {
      data: {
        id: r.id,
        targetType: r.targetType,
        review: r.review
          ? {
              id: r.review.id,
              rating: r.review.rating,
              comment: r.review.comment,
              createdAt: r.review.createdAt,
              isHidden: r.review.isHidden,
              authorName: r.review.user?.name ?? null,
            }
          : null,
        category: r.category,
        reason: r.reason,
        status: r.status,
        createdAt: r.createdAt,
        acknowledgedAt: r.acknowledgedAt,
        acknowledgedByName: r.acknowledgedBy?.name ?? null,
        resolvedAt: r.resolvedAt,
        resolutionNote: r.resolutionNote,
        reporterName: r.user?.name ?? null,
        reporterEmail: r.user?.email ?? null,
        shopId: r.shop.id,
        shopName: r.shop.name,
        shopSlug: r.shop.slug,
        shopIsSuspended: r.shop.isSuspended,
        shopIsUnderReview: r.shop.isUnderReview,
        siblingOpenCount: openSiblings,
        severe: isSevere(r.category),
        sla: complaintSla(r, now),
        audit,
        shopOpenComplaints: others,
      },
    };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'getComplaint' }) };
  }
}
