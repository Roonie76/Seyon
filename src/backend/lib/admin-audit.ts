import { db } from '@/lib/db';
import { logger } from './logger';
import type { Prisma } from '@prisma/client';

/**
 * The record of what an admin did.
 *
 * Every privileged action writes one row. The point is not compliance theatre:
 * it is that suspending a store takes away someone's income, and when they ask
 * why, there has to be an answer that is not "I think someone did it in July".
 *
 * Two design choices worth stating.
 *
 * The write is inside the caller's transaction wherever one exists, so an
 * action and its audit row commit together. An action that succeeded without a
 * record is exactly the gap this closes, and doing the write afterwards
 * reintroduces it on any crash between the two.
 *
 * Destructive actions require a reason, checked here *and* by a database CHECK
 * constraint. The duplication is deliberate: application checks are bypassed by
 * a script, and this is the class of data where someone eventually writes one.
 */

export const ADMIN_ACTIONS = {
  /** The nightly sweep reclaimed uploads nothing ever referenced. */
  SWEEP_ORPHANED_UPLOADS: 'SWEEP_ORPHANED_UPLOADS',
  /** A seller's reply to a notice was read and acted on. */
  REVIEW_NOTICE_RESPONSE: 'REVIEW_NOTICE_RESPONSE',
  VERIFY_SHOP: 'VERIFY_SHOP',
  UNVERIFY_SHOP: 'UNVERIFY_SHOP',
  SUSPEND_SHOP: 'SUSPEND_SHOP',
  UNSUSPEND_SHOP: 'UNSUSPEND_SHOP',
  DELETE_PRODUCT: 'DELETE_PRODUCT',
  DELETE_SHOP: 'DELETE_SHOP',
  RESOLVE_REPORT: 'RESOLVE_REPORT',
  ACKNOWLEDGE_REPORT: 'ACKNOWLEDGE_REPORT',
  REJECT_REPORT: 'REJECT_REPORT',
  HIDE_REVIEW: 'HIDE_REVIEW',
  UNHIDE_REVIEW: 'UNHIDE_REVIEW',
  MARK_UNDER_REVIEW: 'MARK_UNDER_REVIEW',
  CLEAR_UNDER_REVIEW: 'CLEAR_UNDER_REVIEW',
  SEND_NOTICE: 'SEND_NOTICE',
  GRANT_ADMIN: 'GRANT_ADMIN',
  REVOKE_ADMIN: 'REVOKE_ADMIN',
  CHANGE_ROLE: 'CHANGE_ROLE',
  APPROVE_KYC: 'APPROVE_KYC',
  REJECT_KYC: 'REJECT_KYC',
  VIEW_KYC_DOCUMENT: 'VIEW_KYC_DOCUMENT',
  /// Written by the nightly retention sweep, under the system account.
  SWEEP_KYC_DOCUMENTS: 'SWEEP_KYC_DOCUMENTS',
  /// Correcting a store's address or contact number. Requires a reason: the
  /// old address stops being the one people have, so somebody should have
  /// written down why.
  REPAIR_SHOP: 'REPAIR_SHOP',
} as const;

export type AdminActionName = (typeof ADMIN_ACTIONS)[keyof typeof ADMIN_ACTIONS];

/**
 * Mirrors the database CHECK. Keep the two in step — there is an integration
 * test that fails if they drift.
 *
 * The test for membership is not "is this dangerous" but "does someone lose
 * something they would want explained". Hiding a review takes away a buyer's
 * published words and moves a seller's rating; putting a store under review
 * removes its reach. Both qualify. Un-hiding and clearing a review do not:
 * they restore the default, and demanding an essay to undo a mistake just
 * means mistakes stay uncorrected.
 */
const REQUIRES_REASON = new Set<string>([
  ADMIN_ACTIONS.SUSPEND_SHOP,
  ADMIN_ACTIONS.DELETE_PRODUCT,
  ADMIN_ACTIONS.DELETE_SHOP,
  ADMIN_ACTIONS.GRANT_ADMIN,
  ADMIN_ACTIONS.REVOKE_ADMIN,
  ADMIN_ACTIONS.HIDE_REVIEW,
  ADMIN_ACTIONS.MARK_UNDER_REVIEW,
  ADMIN_ACTIONS.REJECT_REPORT,
]);

export function actionRequiresReason(action: string): boolean {
  return REQUIRES_REASON.has(action);
}

export interface AuditInput {
  actorId: string;
  action: AdminActionName;
  targetType: 'Shop' | 'Product' | 'User' | 'Report' | 'SellerKyc' | 'Review' | 'Notice' | 'Upload';
  targetId: string;
  reason?: string | null;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Write the audit row.
 *
 * Pass `tx` when inside a transaction so the record and the change commit
 * together. Throws if a destructive action arrives without a reason — the
 * caller should have collected one, and failing here is better than recording
 * an unexplained suspension.
 */
export async function recordAdminAction(
  input: AuditInput,
  tx: Prisma.TransactionClient | typeof db = db
): Promise<void> {
  const reason = input.reason?.trim() || null;

  if (actionRequiresReason(input.action) && !reason) {
    throw new Error(
      `${input.action} requires a reason. The seller will be told what happened to them, ` +
        'so there has to be something to tell them.'
    );
  }

  await tx.adminAction.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      reason,
      metadata: input.metadata,
    },
  });
}

/**
 * Best-effort variant for paths where losing the action would be worse than
 * losing the record — currently only document views, which are observational
 * rather than changes. Never use this for anything that mutates state.
 */
export async function recordAdminActionSafe(input: AuditInput): Promise<void> {
  try {
    await recordAdminAction(input);
  } catch (err) {
    logger.error('Failed to write admin audit row', err, {
      action: input.action,
      targetType: input.targetType,
    });
  }
}

export interface AuditEntry {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string | null;
  createdAt: Date;
  actorName: string | null;
  actorEmail: string | null;
}

/** History for one target, newest first. */
export async function auditTrailFor(
  targetType: string,
  targetId: string,
  take = 50
): Promise<AuditEntry[]> {
  const rows = await db.adminAction.findMany({
    where: { targetType, targetId },
    orderBy: { createdAt: 'desc' },
    take,
    include: { actor: { select: { name: true, email: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    targetType: r.targetType,
    targetId: r.targetId,
    reason: r.reason,
    createdAt: r.createdAt,
    actorName: r.actor.name,
    actorEmail: r.actor.email,
  }));
}

export interface AuditFilter {
  actorId?: string;
  action?: string;
  targetType?: string;
  /** Inclusive, interpreted in UTC. */
  from?: Date;
  to?: Date;
  /** Opaque keyset cursor: the id of the last row on the previous page. */
  cursor?: string;
  take?: number;
}

export interface AuditPage {
  rows: AuditEntry[];
  /** Pass back as `cursor` to get the next page. Null when there are no more. */
  nextCursor: string | null;
  /** Distinct actors and actions present in the log, for the filter controls. */
  actors: { id: string; name: string | null; email: string | null }[];
}

const MAX_TAKE = 100;

/**
 * Everything every admin did, newest first.
 *
 * `auditTrailFor` answers "what happened to this store". This answers "what has
 * anyone been doing", which is the view you want after something surprising —
 * an admin account nobody remembers creating, a seller certain they were
 * suspended twice, a run of deletions at an odd hour.
 *
 * Paginated by keyset rather than offset. `createdAt` is not unique: several
 * rows land in the same millisecond whenever one action writes more than one
 * row, and offset paging silently skips rows when the ordering ties. The cursor
 * is the last row's id, and the sort is (createdAt desc, id desc) so the order
 * is total.
 */
export async function listAdminActions(filter: AuditFilter = {}): Promise<AuditPage> {
  const take = Math.min(Math.max(filter.take ?? 50, 1), MAX_TAKE);

  const where: Prisma.AdminActionWhereInput = {};
  if (filter.actorId) where.actorId = filter.actorId;
  if (filter.action) where.action = filter.action;
  if (filter.targetType) where.targetType = filter.targetType;
  if (filter.from || filter.to) {
    where.createdAt = {
      ...(filter.from ? { gte: filter.from } : {}),
      ...(filter.to ? { lte: filter.to } : {}),
    };
  }

  const [rows, actorRows] = await Promise.all([
    db.adminAction.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      // One extra row, to know whether a next page exists without counting.
      take: take + 1,
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
      include: { actor: { select: { name: true, email: true } } },
    }),
    // Who appears in the log at all — a short list, since admins are few.
    db.adminAction.findMany({
      distinct: ['actorId'],
      select: { actorId: true, actor: { select: { name: true, email: true } } },
      orderBy: { actorId: 'asc' },
      take: 50,
    }),
  ]);

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;

  return {
    rows: page.map((r) => ({
      id: r.id,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      reason: r.reason,
      createdAt: r.createdAt,
      actorName: r.actor.name,
      actorEmail: r.actor.email,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
    actors: actorRows.map((a) => ({ id: a.actorId, name: a.actor.name, email: a.actor.email })),
  };
}
