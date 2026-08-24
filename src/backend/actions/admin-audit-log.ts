'use server';

import { z } from 'zod';
import { requireAdmin } from '../lib/require-admin';
import { toUserMessage } from '../lib/action-errors';
import { listAdminActions, ADMIN_ACTIONS, type AuditPage } from '../lib/admin-audit';

/**
 * The audit log, read.
 *
 * Deliberately read-only: there is no action in this file that edits or deletes
 * a row, and there is no route that offers one. A log an admin can prune is not
 * evidence of anything.
 */

const TARGET_TYPES = ['Shop', 'Product', 'User', 'Report', 'SellerKyc', 'Review', 'Notice'] as const;

/**
 * A GET form submits every field, including the ones left on their blank
 * option, so each of these arrives as `''` rather than absent. Validating `''`
 * against `.cuid()` or an enum fails, which turned every filter submission into
 * "Invalid filter." — the filters looked broken while the query was fine.
 */
const blankToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), schema.optional());

const FilterSchema = z.object({
  actorId: blankToUndefined(z.string().cuid()),
  action: blankToUndefined(z.enum(Object.keys(ADMIN_ACTIONS) as [string, ...string[]])),
  targetType: blankToUndefined(z.enum(TARGET_TYPES)),
  from: blankToUndefined(z.string()),
  to: blankToUndefined(z.string()),
  cursor: blankToUndefined(z.string().cuid()),
});

/** Parses a `YYYY-MM-DD` from a date input, rejecting anything else. */
function parseDay(value: string | undefined, endOfDay: boolean): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const d = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function getAuditLog(raw: unknown): Promise<{ data: AuditPage } | { error: string }> {
  try {
    await requireAdmin();

    const parsed = FilterSchema.safeParse(raw ?? {});
    if (!parsed.success) return { error: 'Invalid filter.' };
    const f = parsed.data;

    const from = parseDay(f.from, false);
    const to = parseDay(f.to, true);
    if (from && to && from > to) return { error: 'That date range ends before it starts.' };

    return {
      data: await listAdminActions({
        actorId: f.actorId,
        action: f.action,
        targetType: f.targetType,
        from,
        to,
        cursor: f.cursor,
      }),
    };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'getAuditLog' }) };
  }
}
