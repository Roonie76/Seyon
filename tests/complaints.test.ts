import { describe, it, expect } from 'vitest';
import { ReportCategory, ReportStatus } from '@prisma/client';
import {
  complaintSla,
  acknowledgementDueAt,
  resolutionDueAt,
  isSevere,
  REPORT_CATEGORY_LABELS,
  ACK_DEADLINE_HOURS,
  RESOLVE_DEADLINE_DAYS,
} from '@/shared/lib/complaints';

/**
 * The SLA arithmetic, on its own.
 *
 * These are the numbers the Consumer Protection (E-Commerce) Rules 2020 put on
 * a marketplace, so getting them subtly wrong — counting from acknowledgement
 * instead of receipt, say — would produce a queue that looks healthy and is not.
 */

const HOUR = 3_600_000;
const DAY = 86_400_000;

const T0 = new Date('2026-08-01T00:00:00.000Z');

function report(over: Partial<Parameters<typeof complaintSla>[0]> = {}) {
  return {
    createdAt: T0,
    acknowledgedAt: null,
    resolvedAt: null,
    status: ReportStatus.OPEN,
    ...over,
  };
}

describe('deadlines', () => {
  it('counts both clocks from receipt, not from any later step', () => {
    expect(acknowledgementDueAt(T0).getTime()).toBe(T0.getTime() + ACK_DEADLINE_HOURS * HOUR);
    expect(resolutionDueAt(T0).getTime()).toBe(T0.getTime() + RESOLVE_DEADLINE_DAYS * DAY);
  });

  it('uses the 48-hour and 30-day figures the rules actually state', () => {
    expect(ACK_DEADLINE_HOURS).toBe(48);
    expect(RESOLVE_DEADLINE_DAYS).toBe(30);
  });
});

describe('acknowledgement state', () => {
  it('is fine an hour after the complaint arrives', () => {
    const sla = complaintSla(report(), new Date(T0.getTime() + HOUR));
    expect(sla.ackState).toBe('met');
    expect(sla.needsAttention).toBe(false);
    expect(sla.hoursUntilAckDue).toBe(47);
  });

  it('warns before the deadline rather than at it', () => {
    // 40 hours in: 8 left, inside the 12-hour warning band.
    const sla = complaintSla(report(), new Date(T0.getTime() + 40 * HOUR));
    expect(sla.ackState).toBe('due_soon');
    expect(sla.needsAttention).toBe(true);
  });

  it('is overdue once 48 hours have passed unacknowledged', () => {
    const sla = complaintSla(report(), new Date(T0.getTime() + 49 * HOUR));
    expect(sla.ackState).toBe('overdue');
    expect(sla.needsAttention).toBe(true);
    expect(sla.hoursUntilAckDue).toBe(-1);
  });

  it('records a late acknowledgement as breached, not as met', () => {
    // Doing it eventually does not undo having been late — the whole reason to
    // keep this distinct is that "we acknowledged it" and "we acknowledged it
    // in time" are different answers to different questions.
    const sla = complaintSla(
      report({ acknowledgedAt: new Date(T0.getTime() + 72 * HOUR) }),
      new Date(T0.getTime() + 80 * HOUR)
    );
    expect(sla.ackState).toBe('breached');
  });

  it('records an acknowledgement inside the window as met', () => {
    const sla = complaintSla(
      report({ acknowledgedAt: new Date(T0.getTime() + 5 * HOUR) }),
      new Date(T0.getTime() + 80 * HOUR)
    );
    expect(sla.ackState).toBe('met');
  });

  it('stops demanding attention once acknowledged, even long after', () => {
    const sla = complaintSla(
      report({ acknowledgedAt: new Date(T0.getTime() + 5 * HOUR), status: ReportStatus.UNDER_REVIEW }),
      new Date(T0.getTime() + 10 * DAY)
    );
    expect(sla.needsAttention).toBe(false);
  });
});

describe('resolution state', () => {
  it('is overdue when a month passes with the complaint still open', () => {
    const sla = complaintSla(
      report({ acknowledgedAt: new Date(T0.getTime() + HOUR), status: ReportStatus.UNDER_REVIEW }),
      new Date(T0.getTime() + 31 * DAY)
    );
    expect(sla.resolveState).toBe('overdue');
    expect(sla.needsAttention).toBe(true);
  });

  it('treats a rejected complaint as disposed of, the same as a resolved one', () => {
    // REJECTED is a disposal. Counting it as still open would show a permanent
    // backlog of complaints that were in fact dealt with.
    const sla = complaintSla(
      report({
        acknowledgedAt: new Date(T0.getTime() + HOUR),
        resolvedAt: new Date(T0.getTime() + 2 * DAY),
        status: ReportStatus.REJECTED,
      }),
      new Date(T0.getTime() + 60 * DAY)
    );
    expect(sla.resolveState).toBe('met');
    expect(sla.needsAttention).toBe(false);
  });

  it('marks a disposal made after the month as breached', () => {
    const sla = complaintSla(
      report({
        acknowledgedAt: new Date(T0.getTime() + HOUR),
        resolvedAt: new Date(T0.getTime() + 45 * DAY),
        status: ReportStatus.RESOLVED,
      }),
      new Date(T0.getTime() + 50 * DAY)
    );
    expect(sla.resolveState).toBe('breached');
  });
});

describe('categories', () => {
  it('labels every category, so no enum value renders as a raw constant', () => {
    for (const c of Object.values(ReportCategory)) {
      expect(REPORT_CATEGORY_LABELS[c]).toBeTruthy();
      expect(REPORT_CATEGORY_LABELS[c]).not.toBe(c);
    }
  });

  it('treats the categories that can hurt a buyer as serious', () => {
    expect(isSevere(ReportCategory.COUNTERFEIT)).toBe(true);
    expect(isSevere(ReportCategory.FRAUD_OR_SCAM)).toBe(true);
    expect(isSevere(ReportCategory.NON_DELIVERY)).toBe(true);
    expect(isSevere(ReportCategory.OTHER)).toBe(false);
  });
});
