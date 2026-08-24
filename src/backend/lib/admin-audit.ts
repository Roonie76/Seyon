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
  VERIFY_SHOP: 'VERIFY_SHOP',
  UNVERIFY_SHOP: 'UNVERIFY_SHOP',
  SUSPEND_SHOP: 'SUSPEND_SHOP',
  UNSUSPEND_SHOP: 'UNSUSPEND_SHOP',
  DELETE_PRODUCT: 'DELETE_PRODUCT',
  DELETE_SHOP: 'DELETE_SHOP',
  RESOLVE_REPORT: 'RESOLVE_REPORT',
  GRANT_ADMIN: 'GRANT_ADMIN',
  REVOKE_ADMIN: 'REVOKE_ADMIN',
  CHANGE_ROLE: 'CHANGE_ROLE',
  APPROVE_KYC: 'APPROVE_KYC',
  REJECT_KYC: 'REJECT_KYC',
  VIEW_KYC_DOCUMENT: 'VIEW_KYC_DOCUMENT',
} as const;

export type AdminActionName = (typeof ADMIN_ACTIONS)[keyof typeof ADMIN_ACTIONS];

/** Mirrors the database CHECK. Keep the two in step. */
const REQUIRES_REASON = new Set<string>([
  ADMIN_ACTIONS.SUSPEND_SHOP,
  ADMIN_ACTIONS.DELETE_PRODUCT,
  ADMIN_ACTIONS.DELETE_SHOP,
  ADMIN_ACTIONS.GRANT_ADMIN,
  ADMIN_ACTIONS.REVOKE_ADMIN,
]);

export function actionRequiresReason(action: string): boolean {
  return REQUIRES_REASON.has(action);
}

export interface AuditInput {
  actorId: string;
  action: AdminActionName;
  targetType: 'Shop' | 'Product' | 'User' | 'Report' | 'SellerKyc';
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
