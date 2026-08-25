import { db } from '@/lib/db';
import { logger } from './logger';
import { notify } from './notify';
import { deleteKycDocument } from './kyc-storage';
import { emailNotice } from './notices';
import { recordAdminActionSafe, ADMIN_ACTIONS } from './admin-audit';
import { systemActorId } from './system-actor';
import { ACK_DEADLINE_HOURS, RESOLVE_DEADLINE_DAYS } from '@/shared/lib/complaints';
import { Role } from '@prisma/client';
import { SITE_URL } from '@/shared/lib/site';

/**
 * The work that happens without anybody asking.
 *
 * Every job here must be safe to run twice. Vercel can invoke a cron more than
 * once for a single schedule, and a sweep written as though it runs exactly
 * once will delete something it should not the second time. Each of these is
 * written as "find what still needs doing, do that" rather than "do the thing
 * for today", which makes a repeat a no-op rather than a second helping.
 *
 * They also write an audit row only when they actually did something. A daily
 * job that records "swept 0 documents" every night buries the night it swept
 * forty.
 */

/**
 * How long an undecided document may sit before it is swept.
 *
 * A document is deleted when a decision is made. This only catches the ones
 * orphaned in between — a crash after upload, a reviewer who never came back —
 * and the window is generous because sweeping a document a reviewer is midway
 * through looking at is worse than keeping it a fortnight.
 */
export const KYC_DOCUMENT_MAX_AGE_DAYS = 30;

/** How long after a notice's response date before the seller is reminded. */
export const NOTICE_CHASE_GRACE_DAYS = 2;

export interface JobResult {
  name: string;
  did: number;
  detail?: string;
}

/**
 * Delete identity documents nobody decided on.
 *
 * The normal path deletes a document the moment a reviewer approves or rejects.
 * This exists for the abnormal one: a crash between the upload and the
 * decision leaves a file in a private bucket with nothing pointing at it and
 * nobody looking. Minimisation says it should not sit there indefinitely.
 */
export async function sweepAbandonedKycDocuments(now = new Date()): Promise<JobResult> {
  const cutoff = new Date(now.getTime() - KYC_DOCUMENT_MAX_AGE_DAYS * 86_400_000);

  // Still pending, still holding a document, submitted long enough ago. A
  // record that already has `documentDeletedAt` is not selected, so a second
  // run finds nothing left to do.
  const stale = await db.sellerKyc.findMany({
    where: {
      documentPath: { not: null },
      documentDeletedAt: null,
      status: 'PENDING_REVIEW',
      submittedAt: { lt: cutoff },
    },
    select: { id: true, userId: true, documentPath: true, submittedAt: true },
  });

  let deleted = 0;
  for (const row of stale) {
    if (!row.documentPath) continue;

    // Storage first: if the file survives but the row says it is gone, nothing
    // ever tries again. The other order leaves a file nobody will find.
    const ok = await deleteKycDocument(row.documentPath);
    if (!ok) {
      logger.error('Retention sweep could not delete a KYC document', undefined, { kycId: row.id });
      continue;
    }

    await db.sellerKyc.update({
      where: { id: row.id },
      data: { documentPath: null, documentDeletedAt: new Date() },
    });
    deleted += 1;
  }

  if (deleted > 0) {
    await recordAdminActionSafe({
      actorId: await systemActorId(),
      action: ADMIN_ACTIONS.SWEEP_KYC_DOCUMENTS,
      targetType: 'SellerKyc',
      targetId: 'sweep',
      metadata: { deleted, olderThanDays: KYC_DOCUMENT_MAX_AGE_DAYS },
    });
  }

  return { name: 'kyc-retention', did: deleted };
}

/**
 * Remind sellers who were asked something and never answered.
 *
 * Reuses `emailNotice`, so the reminder points at the notice already in their
 * inbox rather than creating a second one. A duplicate notice row would imply
 * a second decision had been taken about them.
 *
 * Idempotent by the grace window: a notice is chased once per run only while it
 * is between its response date and the point the marketplace gives up, and the
 * chase does not change the notice, so two runs on one day send two emails at
 * most — which is the failure mode worth having compared with never chasing.
 */
export async function chaseOverdueNotices(now = new Date()): Promise<JobResult> {
  const graceCutoff = new Date(now.getTime() - NOTICE_CHASE_GRACE_DAYS * 86_400_000);

  const overdue = await db.notice.findMany({
    where: {
      requiresResponse: true,
      respondedAt: null,
      respondBy: { lt: graceCutoff },
    },
    select: { id: true, shopId: true },
    take: 200,
  });

  for (const n of overdue) {
    await emailNotice(n.id);
  }

  return { name: 'notice-chase', did: overdue.length };
}

/**
 * One email to the admins about complaints running out of time.
 *
 * Deliberately a digest rather than an alert per complaint: a moderation queue
 * that emails on every event stops being read, and the thing worth knowing
 * daily is "how many are about to breach", not "something happened".
 */
export async function sendSlaDigest(now = new Date()): Promise<JobResult> {
  const ackCutoff = new Date(now.getTime() - ACK_DEADLINE_HOURS * 3_600_000);
  const resolveCutoff = new Date(now.getTime() - RESOLVE_DEADLINE_DAYS * 86_400_000);
  // Approaching, not yet breached: 12 hours and 3 days out respectively.
  const ackSoon = new Date(ackCutoff.getTime() + 12 * 3_600_000);
  const resolveSoon = new Date(resolveCutoff.getTime() + 3 * 86_400_000);

  const [overdueAck, dueAck, overdueResolve, dueResolve] = await Promise.all([
    db.report.count({ where: { acknowledgedAt: null, createdAt: { lt: ackCutoff } } }),
    db.report.count({
      where: { acknowledgedAt: null, createdAt: { gte: ackCutoff, lt: ackSoon } },
    }),
    db.report.count({ where: { resolvedAt: null, createdAt: { lt: resolveCutoff } } }),
    db.report.count({
      where: { resolvedAt: null, createdAt: { gte: resolveCutoff, lt: resolveSoon } },
    }),
  ]);

  const total = overdueAck + dueAck + overdueResolve + dueResolve;
  // Nothing to say is worth saying nothing about.
  if (total === 0) return { name: 'sla-digest', did: 0 };

  const admins = await db.user.findMany({
    where: { role: Role.ADMIN, email: { not: null } },
    select: { email: true },
  });

  const site = SITE_URL;
  const text =
    'Complaints needing attention on Seyon:\n\n' +
    `${overdueAck} past the ${ACK_DEADLINE_HOURS}-hour acknowledgement deadline\n` +
    `${dueAck} due for acknowledgement within 12 hours\n` +
    `${overdueResolve} past the ${RESOLVE_DEADLINE_DAYS}-day disposal deadline\n` +
    `${dueResolve} due for disposal within 3 days\n\n` +
    `${site}/admin/reports?status=overdue`;

  for (const a of admins) {
    if (!a.email) continue;
    await notify({ to: a.email, subject: 'Seyon: complaints running out of time', text }).catch(
      () => undefined
    );
  }

  return {
    name: 'sla-digest',
    did: total,
    detail: `${overdueAck} ack overdue, ${overdueResolve} disposal overdue`,
  };
}

/**
 * Everything the daily job does, in order.
 *
 * One job rather than three schedules, because the Vercel Hobby plan allows two
 * cron entries at daily granularity. Running them in sequence inside one
 * invocation works on either plan, and moving one to its own schedule later is
 * a config change rather than a rewrite.
 *
 * A failing job must not stop the ones after it: a storage outage should not
 * also cost the marketplace its complaint digest.
 */
export async function runDailyJobs(now = new Date()): Promise<JobResult[]> {
  const jobs = [sweepAbandonedKycDocuments, chaseOverdueNotices, sendSlaDigest];
  const results: JobResult[] = [];

  for (const job of jobs) {
    try {
      results.push(await job(now));
    } catch (err) {
      logger.error('A scheduled job failed', err, { job: job.name });
      results.push({ name: job.name, did: 0, detail: 'failed' });
    }
  }

  return results;
}
