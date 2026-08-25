import { db } from '@/lib/db';
import { logger } from './logger';
import { notify } from './notify';
import type { NoticeKind, Prisma } from '@prisma/client';
import { SITE_URL } from '@/shared/lib/site';

/**
 * Telling a seller something, in a way that survives the email not arriving.
 *
 * Until now every message to a seller went through `notify()` alone. That helper
 * no-ops entirely when RESEND_API_KEY is unset — which is the case in local
 * development and was the case in production for a while — and otherwise logs
 * and swallows delivery failures. So a seller could be suspended and never told,
 * and nothing recorded that we had tried to tell them.
 *
 * A notice is written to the database first, inside the same transaction as
 * whatever it is about, and emailed afterwards on a best-effort basis. The
 * seller's inbox is the channel of record; the email is a convenience that
 * points at it. `emailedAt` distinguishes the two, so "we sent it" and "it left
 * the building" stay separate facts.
 */

export interface IssueNoticeInput {
  shopId: string;
  actorId: string;
  kind: NoticeKind;
  subject: string;
  body: string;
  requiresResponse?: boolean;
  respondBy?: Date | null;
}

export async function issueNotice(
  input: IssueNoticeInput,
  tx: Prisma.TransactionClient | typeof db = db
) {
  const subject = input.subject.trim();
  const body = input.body.trim();

  if (!subject || !body) {
    throw new Error('A notice needs a subject and a body. The seller has to be able to act on it.');
  }

  const requiresResponse = input.requiresResponse ?? false;

  return tx.notice.create({
    data: {
      shopId: input.shopId,
      actorId: input.actorId,
      kind: input.kind,
      subject,
      body,
      requiresResponse,
      // The CHECK constraint refuses a respond-by date on a notice that does
      // not ask for a response; drop it here rather than letting a caller's
      // inconsistency reach the database as an error.
      respondBy: requiresResponse ? (input.respondBy ?? null) : null,
    },
  });
}

/**
 * Best-effort email for a notice already stored.
 *
 * Never throws and never blocks the caller's transaction. Failure means the
 * seller reads it in their inbox instead, which is the whole point of storing
 * it first.
 */
export async function emailNotice(noticeId: string, siteUrl: string = SITE_URL): Promise<void> {
  try {
    const notice = await db.notice.findUnique({
      where: { id: noticeId },
      include: { shop: { select: { name: true, owner: { select: { email: true } } } } },
    });

    if (!notice?.shop.owner.email) return;

    const respondLine = notice.requiresResponse
      ? `\n\nThis notice asks for a response${
          notice.respondBy ? ` by ${notice.respondBy.toLocaleDateString('en-IN')}` : ''
        }. You can reply from your notices page.`
      : '';

    const { sent } = await notify({
      to: notice.shop.owner.email,
      subject: `[Seyon] ${notice.subject}`,
      text:
        `About your storefront "${notice.shop.name}":\n\n` +
        `${notice.body}${respondLine}\n\n` +
        `You can read this notice and any others at ${siteUrl}/notices`,
    });

    if (sent) {
      await db.notice.update({ where: { id: noticeId }, data: { emailedAt: new Date() } });
    }
  } catch (err) {
    // Deliberately swallowed: the notice exists, which is the guarantee.
    logger.error('Failed to email a notice', err, { noticeId });
  }
}

/** Unread count for the seller's own shop, for the dashboard badge. */
export async function unreadNoticeCount(shopId: string): Promise<number> {
  return db.notice.count({ where: { shopId, readAt: null } });
}
