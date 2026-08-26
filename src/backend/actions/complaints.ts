'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { randomUUID } from 'node:crypto';
import { Prisma, ReportCategory, ReportStatus, ReportTarget, NoticeKind } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '../lib/require-admin';
import { recordAdminAction, ADMIN_ACTIONS, auditTrailFor, type AuditEntry } from '../lib/admin-audit';
import { closeComplaintInTx, hideReviewInTx, setShopSuspendedInTx } from '../lib/moderation-ops';
import { issueNotice, emailNotice } from '../lib/notices';
import { toUserMessage } from '../lib/action-errors';
import { notify } from '../lib/notify';
import { complaintSla, isSevere, type ComplaintSla } from '@/shared/lib/complaints';
import { parsePage } from '@/shared/lib/search-params';
import { revalidateShopSurface, revalidateMarketplace } from '@/shared/lib/cache';

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

    await db.$transaction((tx) =>
      closeComplaintInTx(
        tx,
        {
          report: {
            id: report.id, acknowledgedAt: report.acknowledgedAt, createdAt: report.createdAt,
            category: report.category, shopSlug: report.shop.slug,
          },
          outcome,
          note: parsedNote.data,
        },
        { actorId }
      )
    );

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

/* ------------------------------------------------- closing, and acting on it */

const EscalationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('NONE') }),
  z.object({
    type: z.literal('SUSPEND_SHOP'),
    reason: z.string().trim().min(10, 'Say why the store is being suspended. The seller is told this.'),
  }),
  z.object({
    type: z.literal('HIDE_REVIEW'),
    reason: z.string().trim().min(10, 'Say what is wrong with the review — at least a sentence.'),
  }),
  z.object({
    type: z.literal('SEND_NOTICE'),
    kind: z.nativeEnum(NoticeKind),
    subject: z.string().trim().min(5, 'Give the notice a subject.').max(160),
    body: z.string().trim().min(20, 'Write something the seller can act on.').max(4000),
    requiresResponse: z.boolean().optional(),
    respondByDays: z.number().int().min(1).max(90).optional(),
  }),
]);

const CloseWithActionSchema = z.object({
  reportId: IdSchema,
  outcome: z.enum(['RESOLVED', 'REJECTED']),
  note: NoteSchema,
  escalation: EscalationSchema,
});

/**
 * Close a complaint and do something about it, in one transaction.
 *
 * Every action this can take already existed as its own server action. What did
 * not exist was doing them together: a moderator deciding a review was abusive
 * had to close the complaint here, navigate to the store, hide the review
 * there, and hope nothing interrupted them between the two. Steps that require
 * leaving the page are the steps that get skipped.
 *
 * Each act still writes its own audit row. One row saying "closed and
 * suspended" reads well and answers nothing — it cannot separate the
 * suspension reason from the closure note, and it breaks the per-target
 * history that every detail page is built on. Instead the rows share a
 * `correlationId`, so a gesture can be reassembled without being merged.
 *
 * Either everything commits or nothing does. A complaint recorded as closed
 * "with the store suspended" while the store is still live is worse than a
 * failure the moderator can see and retry.
 */
export async function closeComplaintWithActionAction(raw: unknown): Promise<Result> {
  try {
    const parsed = CloseWithActionSchema.safeParse(raw);
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { reportId, outcome, note, escalation } = parsed.data;

    const { actorId } = await requireAdmin();

    const report = await db.report.findUnique({
      where: { id: reportId },
      select: {
        id: true, acknowledgedAt: true, createdAt: true, category: true, resolvedAt: true,
        shopId: true, reviewId: true,
        user: { select: { email: true } },
        shop: { select: { name: true, slug: true, isSuspended: true } },
        review: { select: { id: true, isHidden: true } },
      },
    });
    if (!report) return { error: 'Report not found.' };
    if (report.resolvedAt) return { error: 'This complaint is already closed.' };

    // Refuse impossible combinations before opening a transaction, so the
    // moderator gets a sentence rather than a rolled-back mystery.
    if (escalation.type === 'HIDE_REVIEW') {
      if (!report.review) return { error: 'This complaint is not about a review, so there is none to hide.' };
      if (report.review.isHidden) return { error: 'That review is already hidden. Close the complaint on its own.' };
    }
    if (escalation.type === 'SUSPEND_SHOP' && report.shop.isSuspended) {
      return { error: 'That store is already suspended. Close the complaint on its own.' };
    }

    // Shared by every row this gesture writes.
    const correlationId = randomUUID();
    const ctx = { actorId, correlationId };

    const outcomes = await db.$transaction(async (tx) => {
      let noticeId: string | null = null;

      // The escalation runs first: if suspending fails, the complaint must not
      // be recorded as closed on the strength of it.
      if (escalation.type === 'SUSPEND_SHOP') {
        const res = await setShopSuspendedInTx(
          tx,
          { shopId: report.shopId, isSuspended: true, reason: escalation.reason },
          ctx
        );
        noticeId = res.noticeId;
      } else if (escalation.type === 'HIDE_REVIEW') {
        await hideReviewInTx(tx, { reviewId: report.review!.id, reason: escalation.reason }, ctx);
      } else if (escalation.type === 'SEND_NOTICE') {
        const created = await issueNotice(
          {
            shopId: report.shopId,
            actorId,
            kind: escalation.kind,
            subject: escalation.subject,
            body: escalation.body,
            requiresResponse: escalation.requiresResponse ?? false,
            respondBy:
              escalation.requiresResponse && escalation.respondByDays
                ? new Date(Date.now() + escalation.respondByDays * 86_400_000)
                : null,
          },
          tx
        );
        await recordAdminAction(
          {
            actorId,
            action: ADMIN_ACTIONS.SEND_NOTICE,
            targetType: 'Shop',
            targetId: report.shopId,
            metadata: {
              noticeId: created.id, kind: escalation.kind, subject: escalation.subject,
              correlationId,
            },
          },
          tx
        );
        noticeId = created.id;
      }

      await closeComplaintInTx(
        tx,
        {
          report: {
            id: report.id, acknowledgedAt: report.acknowledgedAt, createdAt: report.createdAt,
            category: report.category, shopSlug: report.shop.slug,
          },
          outcome,
          note,
        },
        ctx
      );

      return { noticeId };
    });

    // Outside the transaction: neither of these may hold it open or fail it.
    if (outcomes.noticeId) emailNotice(outcomes.noticeId).catch(() => undefined);

    if (report.user?.email) {
      notify({
        to: report.user.email,
        subject: `Your report about "${report.shop.name}" is closed`,
        text:
          outcome === 'RESOLVED'
            ? `Your report about the storefront "${report.shop.name}" has been reviewed and acted on.\n\nWhat happened:\n${note}`
            : `Your report about the storefront "${report.shop.name}" has been reviewed. We did not find a breach of our policies.\n\nWhy:\n${note}\n\nIf you have more information, report it again and it will be looked at fresh.`,
      }).catch(() => undefined);
    }

    revalidateShopSurface(report.shop.slug);
    revalidateMarketplace();
    revalidatePath('/admin', 'layout');
    revalidatePath('/notices');
    return { success: true };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'closeComplaintWithAction' }) };
  }
}
