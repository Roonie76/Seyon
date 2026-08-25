import { ACK_DEADLINE_HOURS, RESOLVE_DEADLINE_DAYS } from './complaints';

/**
 * How the marketplace actually did, over a period.
 *
 * The live counters answer "what is late right now". The question the Consumer
 * Protection (E-Commerce) Rules put to a marketplace arrives as a period —
 * "of the complaints you received in July, how many did you acknowledge inside
 * forty-eight hours" — and that cannot be read off a queue.
 *
 * ## The mistake this is written to avoid
 *
 * The easy version of this query filters on `resolvedAt IS NOT NULL` and
 * reports the share of *closed* complaints that were closed in time. That
 * reads beautifully and is worthless: a complaint still open after a year is
 * excluded from the denominator entirely, so the worst possible handling
 * produces a perfect score. Here a complaint past its deadline is a miss
 * whether or not it was ever dealt with, and `stillOpen` is reported separately
 * so nobody has to infer it.
 *
 * Pure functions over timestamps, so the arithmetic can be tested at its
 * boundaries without a database.
 */

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export interface SlaReportRow {
  id: string;
  createdAt: Date;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
}

export type SlaMissKind = 'ACKNOWLEDGEMENT' | 'DISPOSAL';

export interface SlaMiss {
  id: string;
  kind: SlaMissKind;
  /** Hours late for acknowledgement, days late for disposal. */
  lateBy: number;
  stillOpen: boolean;
}

export interface SlaMonth {
  /** `YYYY-MM`, in UTC. */
  month: string;
  received: number;

  acknowledgedInTime: number;
  acknowledgedLate: number;
  /** Never acknowledged and already past the deadline. */
  acknowledgementMissing: number;

  disposedInTime: number;
  disposedLate: number;
  /** Never disposed of and already past the deadline. */
  disposalMissing: number;

  /** Still open, whether or not their deadlines have passed. */
  stillOpen: number;

  /** Null when nothing in the month has been acknowledged yet. */
  medianHoursToAcknowledge: number | null;
  medianDaysToDispose: number | null;

  /** In time as a share of everything received. Null for an empty month. */
  acknowledgementRate: number | null;
  disposalRate: number | null;
}

export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Lower median: with an even count, the lower of the two middle values. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

function ackDue(r: SlaReportRow): number {
  return r.createdAt.getTime() + ACK_DEADLINE_HOURS * HOUR_MS;
}

function disposalDue(r: SlaReportRow): number {
  return r.createdAt.getTime() + RESOLVE_DEADLINE_DAYS * DAY_MS;
}

/**
 * Every deadline this complaint missed.
 *
 * A complaint can miss both, and both are reported: acknowledging late does not
 * excuse disposing late, and the two obligations are separate in the rules.
 */
export function missesFor(r: SlaReportRow, now: Date): SlaMiss[] {
  const misses: SlaMiss[] = [];
  const n = now.getTime();

  if (r.acknowledgedAt) {
    if (r.acknowledgedAt.getTime() > ackDue(r)) {
      misses.push({
        id: r.id,
        kind: 'ACKNOWLEDGEMENT',
        lateBy: Math.round((r.acknowledgedAt.getTime() - ackDue(r)) / HOUR_MS),
        stillOpen: r.resolvedAt === null,
      });
    }
  } else if (n > ackDue(r)) {
    // Not acknowledged and out of time. Counting this only once it is finally
    // acknowledged is how a permanently ignored complaint scores perfectly.
    misses.push({
      id: r.id,
      kind: 'ACKNOWLEDGEMENT',
      lateBy: Math.round((n - ackDue(r)) / HOUR_MS),
      stillOpen: true,
    });
  }

  if (r.resolvedAt) {
    if (r.resolvedAt.getTime() > disposalDue(r)) {
      misses.push({
        id: r.id,
        kind: 'DISPOSAL',
        lateBy: Math.round((r.resolvedAt.getTime() - disposalDue(r)) / DAY_MS),
        stillOpen: false,
      });
    }
  } else if (n > disposalDue(r)) {
    misses.push({
      id: r.id,
      kind: 'DISPOSAL',
      lateBy: Math.round((n - disposalDue(r)) / DAY_MS),
      stillOpen: true,
    });
  }

  return misses;
}

/**
 * Group by the month a complaint was *received*.
 *
 * By receipt rather than by disposal, because the deadline runs from receipt. A
 * complaint received in June and closed in August is June's miss; filing it
 * under August would let a bad month be rescued by closing everything late in
 * the next one.
 */
export function summariseByMonth(rows: SlaReportRow[], now: Date): SlaMonth[] {
  const buckets = new Map<string, SlaReportRow[]>();
  for (const r of rows) {
    const key = monthKey(r.createdAt);
    const list = buckets.get(key);
    if (list) list.push(r);
    else buckets.set(key, [r]);
  }

  const months: SlaMonth[] = [];

  for (const [month, list] of buckets) {
    let acknowledgedInTime = 0;
    let acknowledgedLate = 0;
    let acknowledgementMissing = 0;
    let disposedInTime = 0;
    let disposedLate = 0;
    let disposalMissing = 0;
    let stillOpen = 0;

    const ackHours: number[] = [];
    const disposeDays: number[] = [];

    for (const r of list) {
      if (r.acknowledgedAt) {
        ackHours.push((r.acknowledgedAt.getTime() - r.createdAt.getTime()) / HOUR_MS);
        if (r.acknowledgedAt.getTime() <= ackDue(r)) acknowledgedInTime += 1;
        else acknowledgedLate += 1;
      } else if (now.getTime() > ackDue(r)) {
        acknowledgementMissing += 1;
      }

      if (r.resolvedAt) {
        disposeDays.push((r.resolvedAt.getTime() - r.createdAt.getTime()) / DAY_MS);
        if (r.resolvedAt.getTime() <= disposalDue(r)) disposedInTime += 1;
        else disposedLate += 1;
      } else {
        stillOpen += 1;
        if (now.getTime() > disposalDue(r)) disposalMissing += 1;
      }
    }

    const received = list.length;

    months.push({
      month,
      received,
      acknowledgedInTime,
      acknowledgedLate,
      acknowledgementMissing,
      disposedInTime,
      disposedLate,
      disposalMissing,
      stillOpen,
      medianHoursToAcknowledge: round1(median(ackHours)),
      medianDaysToDispose: round1(median(disposeDays)),
      // The denominator is everything received, not everything closed. A
      // complaint nobody ever touched drags the rate down, which is the point.
      acknowledgementRate: received === 0 ? null : acknowledgedInTime / received,
      disposalRate: received === 0 ? null : disposedInTime / received,
    });
  }

  // Newest month first.
  return months.sort((a, b) => (a.month < b.month ? 1 : -1));
}

function round1(v: number | null): number | null {
  return v === null ? null : Math.round(v * 10) / 10;
}

/** One row per month, for the export. */
export function toCsv(months: SlaMonth[]): string {
  const header = [
    'month',
    'received',
    'acknowledged_in_time',
    'acknowledged_late',
    'acknowledgement_missing',
    'acknowledgement_rate',
    'disposed_in_time',
    'disposed_late',
    'disposal_missing',
    'disposal_rate',
    'still_open',
    'median_hours_to_acknowledge',
    'median_days_to_dispose',
  ].join(',');

  const lines = months.map((m) =>
    [
      m.month,
      m.received,
      m.acknowledgedInTime,
      m.acknowledgedLate,
      m.acknowledgementMissing,
      m.acknowledgementRate === null ? '' : m.acknowledgementRate.toFixed(4),
      m.disposedInTime,
      m.disposedLate,
      m.disposalMissing,
      m.disposalRate === null ? '' : m.disposalRate.toFixed(4),
      m.stillOpen,
      m.medianHoursToAcknowledge ?? '',
      m.medianDaysToDispose ?? '',
    ].join(',')
  );

  return [header, ...lines].join('\n') + '\n';
}
