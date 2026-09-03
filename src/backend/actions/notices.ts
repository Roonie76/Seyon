'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { NoticeKind } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { requireAdmin } from '../lib/require-admin';
import { recordAdminAction, recordAdminActionSafe, ADMIN_ACTIONS } from '../lib/admin-audit';
import { issueNotice, emailNotice } from '../lib/notices';
import { toUserMessage } from '../lib/action-errors';

/**
 * Sending a seller a notice, and letting them read and answer it.
 *
 * The thing this replaces is an email that may never have been sent. The notice
 * row is the record; the email points at it. A seller who never got the email
 * still has the notice waiting the next time they open their dashboard, and the
 * marketplace can show exactly what was sent and when.
 */

const IdSchema = z.string().cuid('Invalid identifier');

const ComposeSchema = z.object({
  shopId: IdSchema,
  /**
   * Only the kinds that are genuinely a message.
   *
   * SUSPENSION, REINSTATEMENT and IDENTITY_DECISION are receipts for a state
   * change and are issued by the action that makes the change. Accepting them
   * here let an admin tell a seller their store was suspended without
   * suspending it — this action writes a notice and never touches the shop.
   * The dropdown is narrowed too; this is the half that cannot be bypassed.
   */
  kind: z.enum(['WARNING', 'POLICY_VIOLATION', 'INFORMATION_REQUEST']),
  subject: z.string().trim().min(5, 'Give the notice a subject.').max(160, 'Keep the subject under 160 characters.'),
  body: z
    .string()
    .trim()
    .min(20, 'Write something the seller can act on — at least a couple of sentences.')
    .max(4000, 'Keep the notice under 4000 characters.'),
  requiresResponse: z.boolean().optional(),
  respondByDays: z.number().int().min(1).max(90).optional(),
});

type Result = { success: true; error?: undefined } | { success?: undefined; error: string };

export async function sendNoticeAction(raw: unknown): Promise<Result> {
  try {
    const parsed = ComposeSchema.safeParse(raw);
    if (!parsed.success) return { error: parsed.error.issues[0].message };

    const { actorId } = await requireAdmin();
    const { shopId, kind, subject, body, requiresResponse = false, respondByDays } = parsed.data;

    const shop = await db.shop.findUnique({ where: { id: shopId }, select: { id: true, slug: true } });
    if (!shop) return { error: 'Store not found.' };

    const respondBy =
      requiresResponse && respondByDays
        ? new Date(Date.now() + respondByDays * 86_400_000)
        : null;

    const notice = await db.$transaction(async (tx) => {
      const created = await issueNotice(
        { shopId: shop.id, actorId, kind, subject, body, requiresResponse, respondBy },
        tx
      );
      await recordAdminAction(
        {
          actorId,
          action: ADMIN_ACTIONS.SEND_NOTICE,
          targetType: 'Shop',
          targetId: shop.id,
          metadata: { noticeId: created.id, kind, subject, requiresResponse },
        },
        tx
      );
      return created;
    });

    emailNotice(notice.id).catch(() => undefined);

    revalidatePath('/admin', 'layout');
    revalidatePath('/notices');
    return { success: true };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'sendNotice' }) };
  }
}

export interface SellerNotice {
  id: string;
  kind: NoticeKind;
  subject: string;
  body: string;
  requiresResponse: boolean;
  respondBy: Date | null;
  sentAt: Date;
  emailedAt: Date | null;
  readAt: Date | null;
  respondedAt: Date | null;
  response: string | null;
}

/** The signed-in seller's own notices. Never takes a shop id from the caller. */
export async function getMyNotices(): Promise<{ data: SellerNotice[] } | { error: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { error: 'You must be signed in.' };

    const shop = await db.shop.findUnique({
      where: { ownerId: session.user.id },
      select: { id: true },
    });
    if (!shop) return { data: [] };

    const rows = await db.notice.findMany({
      where: { shopId: shop.id },
      orderBy: { sentAt: 'desc' },
      take: 100,
    });

    return { data: rows };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'getMyNotices' }) };
  }
}

/**
 * Mark a notice read.
 *
 * Scoped by the caller's own shop rather than by notice id alone — otherwise
 * any signed-in seller could mark another seller's notice as read, which would
 * quietly corrupt the one field that answers "did they see it".
 */
export async function markNoticeReadAction(noticeId: string): Promise<Result> {
  try {
    const id = IdSchema.safeParse(noticeId);
    if (!id.success) return { error: 'Invalid notice id.' };

    const session = await auth();
    if (!session?.user?.id) return { error: 'You must be signed in.' };

    const shop = await db.shop.findUnique({ where: { ownerId: session.user.id }, select: { id: true } });
    if (!shop) return { error: 'No storefront on this account.' };

    const updated = await db.notice.updateMany({
      where: { id: id.data, shopId: shop.id, readAt: null },
      data: { readAt: new Date() },
    });

    if (updated.count > 0) revalidatePath('/notices');
    return { success: true };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'markNoticeRead' }) };
  }
}

const ResponseSchema = z
  .string()
  .trim()
  .min(10, 'Write a little more than that.')
  .max(4000, 'Keep the response under 4000 characters.');

export async function respondToNoticeAction(noticeId: string, response: string): Promise<Result> {
  try {
    const id = IdSchema.safeParse(noticeId);
    if (!id.success) return { error: 'Invalid notice id.' };

    const parsed = ResponseSchema.safeParse(response);
    if (!parsed.success) return { error: parsed.error.issues[0].message };

    const session = await auth();
    if (!session?.user?.id) return { error: 'You must be signed in.' };

    const shop = await db.shop.findUnique({ where: { ownerId: session.user.id }, select: { id: true } });
    if (!shop) return { error: 'No storefront on this account.' };

    const notice = await db.notice.findFirst({
      where: { id: id.data, shopId: shop.id },
      select: { id: true, respondedAt: true, readAt: true, requiresResponse: true },
    });
    if (!notice) return { error: 'Notice not found.' };
    if (notice.respondedAt) return { error: 'You have already responded to this notice.' };

    /**
     * A response belongs on a notice that asked for one.
     *
     * The inbox only renders the box when `requiresResponse` is set, but this
     * is a directly callable server action — so text could be attached to a
     * REINSTATEMENT, where no queue would ever surface it.
     */
    if (!notice.requiresResponse) {
      return { error: 'This notice does not ask for a response.' };
    }

    await db.notice.update({
      where: { id: notice.id },
      data: {
        respondedAt: new Date(),
        response: parsed.data,
        /**
         * Establish a read, never move one.
         *
         * This was an unconditional `new Date()`. A notice read on the 1st and
         * answered on the 10th had its `readAt` rewritten to the 10th, and the
         * admin queue then showed "Read 10/9" — erasing nine days of "they knew
         * and did nothing". The inbox goes to lengths to protect this field
         * precisely because it is evidence in a dispute.
         */
        readAt: notice.readAt ?? new Date(),
      },
    });

    revalidatePath('/notices');
    revalidatePath('/admin', 'layout');
    return { success: true };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'respondToNotice' }) };
  }
}

/** Notices for one store, for the admin store page. */
export async function getShopNotices(
  shopId: string
): Promise<{ data: (SellerNotice & { actorName: string | null })[] } | { error: string }> {
  try {
    await requireAdmin();

    const id = IdSchema.safeParse(shopId);
    if (!id.success) return { error: 'Invalid shop id.' };

    const rows = await db.notice.findMany({
      where: { shopId: id.data },
      orderBy: { sentAt: 'desc' },
      take: 50,
      include: { actor: { select: { name: true } } },
    });

    return { data: rows.map((r) => ({ ...r, actorName: r.actor?.name ?? null })) };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'getShopNotices' }) };
  }
}

/* ----------------------------------------------------- the marketplace view */

const NOTICE_PAGE_SIZE = 25;

const NoticeQueueSchema = z.object({
  filter: z.enum(['all', 'unread', 'awaiting', 'overdue', 'replied']).optional(),
  page: z.string().optional(),
});

export interface AdminNoticeRow {
  id: string;
  kind: NoticeKind;
  subject: string;
  body: string;
  sentAt: Date;
  emailedAt: Date | null;
  readAt: Date | null;
  respondedAt: Date | null;
  response: string | null;
  requiresResponse: boolean;
  respondBy: Date | null;
  /** Asked for a response, past the date, still nothing back. */
  overdue: boolean;
  /** The seller replied and no one has closed the loop yet. */
  awaitingReview: boolean;
  shopName: string;
  shopSlug: string;
  actorName: string | null;
}

export interface AdminNoticeQueue {
  rows: AdminNoticeRow[];
  total: number;
  page: number;
  pageCount: number;
  counts: { unread: number; awaiting: number; overdue: number; replied: number };
}

/**
 * Every notice the marketplace has sent.
 *
 * The seller's inbox has existed since notices did; nothing showed the other
 * side of it. You could prove a notice was sent and not see, in one place,
 * which ones were never opened and which asked a question nobody answered.
 */
export async function getNoticeQueue(
  raw: unknown
): Promise<{ data: AdminNoticeQueue } | { error: string }> {
  try {
    await requireAdmin();

    const parsed = NoticeQueueSchema.safeParse(raw ?? {});
    if (!parsed.success) return { error: 'Invalid filter.' };
    const filter = parsed.data.filter ?? 'all';
    const page = Math.max(1, Number.parseInt(parsed.data.page ?? '1', 10) || 1);

    const now = new Date();
    const overdueWhere = {
      requiresResponse: true,
      respondedAt: null,
      respondBy: { lt: now },
    } as const;

    /**
     * A reply that nobody has acted on.
     *
     * Answering removed a notice from `awaiting` and from `overdue`, and there
     * was no third state — so a suspended seller's appeal landed in the
     * undifferentiated `all` list, newest first, twenty-five to a page, with
     * nobody told it had arrived. This is the queue that matters most: someone
     * whose store is offline is waiting on it.
     */
    const repliedWhere = { respondedAt: { not: null }, reviewedAt: null } as const;

    const where =
      filter === 'unread'
        ? { readAt: null }
        : filter === 'awaiting'
          ? { requiresResponse: true, respondedAt: null }
          : filter === 'overdue'
            ? overdueWhere
            : filter === 'replied'
              ? repliedWhere
              : {};

    const [total, rows, unread, awaiting, overdue, replied] = await Promise.all([
      db.notice.count({ where }),
      db.notice.findMany({
        where,
        // Oldest first for the queues that need chasing; a list sorted
        // newest-first is how the oldest unanswered notice is never reached.
        orderBy: filter === 'all' ? { sentAt: 'desc' } : { sentAt: 'asc' },
        skip: (page - 1) * NOTICE_PAGE_SIZE,
        take: NOTICE_PAGE_SIZE,
        include: {
          shop: { select: { name: true, slug: true } },
          actor: { select: { name: true } },
        },
      }),
      db.notice.count({ where: { readAt: null } }),
      db.notice.count({ where: { requiresResponse: true, respondedAt: null } }),
      db.notice.count({ where: overdueWhere }),
      db.notice.count({ where: repliedWhere }),
    ]);

    return {
      data: {
        rows: rows.map((n) => ({
          id: n.id,
          kind: n.kind,
          subject: n.subject,
          body: n.body,
          sentAt: n.sentAt,
          emailedAt: n.emailedAt,
          readAt: n.readAt,
          respondedAt: n.respondedAt,
          response: n.response,
          requiresResponse: n.requiresResponse,
          respondBy: n.respondBy,
          overdue: Boolean(
            n.requiresResponse && !n.respondedAt && n.respondBy && n.respondBy < now
          ),
          awaitingReview: Boolean(n.respondedAt && !n.reviewedAt),
          shopName: n.shop.name,
          shopSlug: n.shop.slug,
          actorName: n.actor.name,
        })),
        total,
        page,
        pageCount: Math.max(1, Math.ceil(total / NOTICE_PAGE_SIZE)),
        counts: { unread, awaiting, overdue, replied },
      },
    };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'getNoticeQueue' }) };
  }
}

/**
 * Send the email for a notice again.
 *
 * Deliberately not "send the notice again": the notice already exists and the
 * seller already has it. This retries the convenience copy, for the case where
 * email was unconfigured or bouncing when it was first issued. It writes no new
 * notice row, because a duplicate in the seller's inbox would imply a second
 * decision was taken.
 */
export async function resendNoticeEmailAction(noticeId: string): Promise<Result> {
  try {
    const id = IdSchema.safeParse(noticeId);
    if (!id.success) return { error: 'Invalid notice id.' };

    const { actorId } = await requireAdmin();

    const notice = await db.notice.findUnique({
      where: { id: id.data },
      select: { id: true, shopId: true, subject: true },
    });
    if (!notice) return { error: 'Notice not found.' };

    await emailNotice(notice.id);

    // Observational rather than a state change, so a failure to record it must
    // not fail the resend.
    await recordAdminAction({
      actorId,
      action: ADMIN_ACTIONS.SEND_NOTICE,
      targetType: 'Shop',
      targetId: notice.shopId,
      metadata: { noticeId: notice.id, subject: notice.subject, resend: true },
    }).catch(() => undefined);

    revalidatePath('/admin', 'layout');
    return { success: true };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'resendNoticeEmail' }) };
  }
}

/**
 * Mark a seller's reply as dealt with.
 *
 * Without this there was no way to distinguish "they replied and we are on it"
 * from "they replied three weeks ago and nobody looked", because answering
 * removed the notice from every actionable queue. Resolving is a deliberate
 * act by a named person, recorded like the other admin decisions.
 */
export async function markNoticeReviewedAction(raw: unknown): Promise<Result> {
  try {
    const id = IdSchema.safeParse(raw);
    if (!id.success) return { error: 'Invalid notice.' };

    const { actorId } = await requireAdmin();

    const notice = await db.notice.findUnique({
      where: { id: id.data },
      select: { id: true, respondedAt: true, reviewedAt: true },
    });
    if (!notice) return { error: 'Notice not found.' };
    if (!notice.respondedAt) return { error: 'There is no response to review yet.' };
    if (notice.reviewedAt) return { error: 'This response has already been reviewed.' };

    await db.notice.update({
      where: { id: notice.id },
      data: { reviewedAt: new Date() },
    });

    await recordAdminActionSafe({
      actorId,
      action: ADMIN_ACTIONS.REVIEW_NOTICE_RESPONSE,
      targetType: 'Notice',
      targetId: notice.id,
    });

    revalidatePath('/admin', 'layout');
    return { success: true };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'markNoticeReviewedAction' }) };
  }
}
