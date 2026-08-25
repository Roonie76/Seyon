'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { requireAdmin } from '../lib/require-admin';
import { toUserMessage } from '../lib/action-errors';
import {
  summariseByMonth,
  missesFor,
  type SlaMonth,
  type SlaMiss,
} from '@/shared/lib/sla-performance';
import { REPORT_CATEGORY_LABELS } from '@/shared/lib/complaints';
import type { ReportCategory } from '@prisma/client';

/**
 * The compliance question, answered over a period.
 *
 * Reads the timestamps migration 5 added and nothing else — no new columns, no
 * stored aggregates. A stored score would have to be recomputed whenever the
 * deadlines changed, and the deadlines are the one thing that might.
 */

const RangeSchema = z.object({
  months: z.coerce.number().int().min(1).max(24).optional(),
});

export interface NamedMiss extends SlaMiss {
  category: string;
  shopName: string;
  shopSlug: string;
  createdAt: Date;
}

export interface SlaPerformance {
  months: SlaMonth[];
  /** Every complaint that missed a deadline, worst first. */
  misses: NamedMiss[];
  monthsCovered: number;
  generatedAt: Date;
}

export async function getSlaPerformance(
  raw: unknown
): Promise<{ data: SlaPerformance } | { error: string }> {
  try {
    await requireAdmin();

    const parsed = RangeSchema.safeParse(raw ?? {});
    if (!parsed.success) return { error: 'Invalid range.' };
    const monthsCovered = parsed.data.months ?? 6;

    const now = new Date();
    // From the first day of the month `monthsCovered - 1` months back, so a
    // "6 months" report covers six whole months rather than 180 days.
    const from = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (monthsCovered - 1), 1, 0, 0, 0, 0)
    );

    const rows = await db.report.findMany({
      where: { createdAt: { gte: from } },
      select: {
        id: true, createdAt: true, acknowledgedAt: true, resolvedAt: true, category: true,
        shop: { select: { name: true, slug: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const months = summariseByMonth(
      rows.map((r) => ({
        id: r.id, createdAt: r.createdAt,
        acknowledgedAt: r.acknowledgedAt, resolvedAt: r.resolvedAt,
      })),
      now
    );

    const byId = new Map(rows.map((r) => [r.id, r]));
    const misses: NamedMiss[] = rows
      .flatMap((r) =>
        missesFor(
          { id: r.id, createdAt: r.createdAt, acknowledgedAt: r.acknowledgedAt, resolvedAt: r.resolvedAt },
          now
        )
      )
      .map((m) => {
        const r = byId.get(m.id)!;
        return {
          ...m,
          category: REPORT_CATEGORY_LABELS[r.category as ReportCategory],
          shopName: r.shop.name,
          shopSlug: r.shop.slug,
          createdAt: r.createdAt,
        };
      })
      // Worst first, and the ones still open above the ones already dealt with:
      // a historic miss is a fact, an open one is a job.
      .sort((a, b) => Number(b.stillOpen) - Number(a.stillOpen) || b.lateBy - a.lateBy);

    return { data: { months, misses, monthsCovered, generatedAt: now } };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'getSlaPerformance' }) };
  }
}
