'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { NoticeKind } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { requireAdmin } from '../lib/require-admin';
import { recordAdminAction, ADMIN_ACTIONS } from '../lib/admin-audit';
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
  kind: z.nativeEnum(NoticeKind),
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
      select: { id: true, respondedAt: true },
    });
    if (!notice) return { error: 'Notice not found.' };
    if (notice.respondedAt) return { error: 'You have already responded to this notice.' };

    await db.notice.update({
      where: { id: notice.id },
      data: { respondedAt: new Date(), response: parsed.data, readAt: new Date() },
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
