import { ReportCategory, ReportStatus } from '@prisma/client';

/**
 * The clock a marketplace is held to on consumer complaints.
 *
 * The Consumer Protection (E-Commerce) Rules 2020 require a marketplace entity
 * to acknowledge a consumer complaint within forty-eight hours of receiving it,
 * and to dispose of it within one month. Those two numbers were nowhere in this
 * codebase: `Report` had a status and a creation date, so "is anything overdue"
 * could not be asked, let alone answered.
 *
 * Deadlines are derived from `createdAt` rather than stored, so that changing
 * the rule here corrects every existing row instead of only new ones.
 */

/** Acknowledge within 48 hours of receipt. */
export const ACK_DEADLINE_HOURS = 48;

/** Dispose of the complaint within one month. Thirty days, counted plainly. */
export const RESOLVE_DEADLINE_DAYS = 30;

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export function acknowledgementDueAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + ACK_DEADLINE_HOURS * HOUR_MS);
}

export function resolutionDueAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + RESOLVE_DEADLINE_DAYS * DAY_MS);
}

export type SlaState = 'met' | 'due_soon' | 'overdue' | 'breached';

export interface ComplaintSla {
  ackDueAt: Date;
  resolveDueAt: Date;
  /** Whether acknowledgement happened, and whether it happened in time. */
  ackState: SlaState;
  resolveState: SlaState;
  /** True when either clock has run out and the corresponding step is undone. */
  needsAttention: boolean;
  hoursUntilAckDue: number;
  daysUntilResolveDue: number;
}

interface ReportTiming {
  createdAt: Date;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  status: ReportStatus;
}

/**
 * Where one complaint stands against both deadlines.
 *
 * `now` is a parameter rather than a call to `Date.now()` so this is testable
 * without freezing the clock, and so a queue rendering fifty rows evaluates
 * them all against one instant instead of fifty slightly different ones.
 */
export function complaintSla(report: ReportTiming, now: Date = new Date()): ComplaintSla {
  const ackDueAt = acknowledgementDueAt(report.createdAt);
  const resolveDueAt = resolutionDueAt(report.createdAt);

  // "breached" is reserved for a deadline that passed while the step was still
  // undone — a permanent fact about this complaint. "met" covers doing it in
  // time; a step completed late is still breached, because it was.
  const ackState: SlaState = report.acknowledgedAt
    ? report.acknowledgedAt <= ackDueAt
      ? 'met'
      : 'breached'
    : now > ackDueAt
      ? 'overdue'
      : now.getTime() > ackDueAt.getTime() - 12 * HOUR_MS
        ? 'due_soon'
        : 'met';

  const isTerminal = report.status === ReportStatus.RESOLVED || report.status === ReportStatus.REJECTED;

  const resolveState: SlaState = report.resolvedAt
    ? report.resolvedAt <= resolveDueAt
      ? 'met'
      : 'breached'
    : now > resolveDueAt
      ? 'overdue'
      : now.getTime() > resolveDueAt.getTime() - 3 * DAY_MS
        ? 'due_soon'
        : 'met';

  return {
    ackDueAt,
    resolveDueAt,
    ackState,
    resolveState,
    needsAttention:
      (!report.acknowledgedAt && (ackState === 'overdue' || ackState === 'due_soon')) ||
      (!isTerminal && (resolveState === 'overdue' || resolveState === 'due_soon')),
    hoursUntilAckDue: Math.round((ackDueAt.getTime() - now.getTime()) / HOUR_MS),
    daysUntilResolveDue: Math.round((resolveDueAt.getTime() - now.getTime()) / DAY_MS),
  };
}

/** Human labels for the report categories, for both the buyer form and the queue. */
export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  COUNTERFEIT: 'Counterfeit or fake goods',
  PROHIBITED_ITEM: 'Prohibited or illegal item',
  FRAUD_OR_SCAM: 'Fraud or scam',
  MISLEADING_LISTING: 'Misleading listing or price',
  OFFENSIVE_CONTENT: 'Offensive or abusive content',
  IMPERSONATION: 'Impersonating a brand or person',
  NON_DELIVERY: 'Paid but never received the goods',
  OTHER: 'Something else',
};

/**
 * Categories serious enough that the store should be looked at, not just the
 * complaint. Used only to sort the queue — nothing is automated off this,
 * because an accusation is not a finding.
 */
export const SEVERE_CATEGORIES: ReportCategory[] = [
  ReportCategory.COUNTERFEIT,
  ReportCategory.PROHIBITED_ITEM,
  ReportCategory.FRAUD_OR_SCAM,
  ReportCategory.NON_DELIVERY,
];

export function isSevere(category: ReportCategory): boolean {
  return SEVERE_CATEGORIES.includes(category);
}
