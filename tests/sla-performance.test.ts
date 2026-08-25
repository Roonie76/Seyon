import { describe, it, expect } from 'vitest';
import {
  summariseByMonth,
  missesFor,
  median,
  monthKey,
  toCsv,
  type SlaReportRow,
} from '@/shared/lib/sla-performance';
import { ACK_DEADLINE_HOURS, RESOLVE_DEADLINE_DAYS } from '@/shared/lib/complaints';

/**
 * The arithmetic behind the compliance report.
 *
 * The test that matters most is the one asserting a complaint nobody ever
 * touched counts against the score. The obvious implementation — report the
 * share of *closed* complaints closed in time — excludes it from the
 * denominator entirely, so ignoring every complaint forever produces a perfect
 * record. That is a plausible, readable, completely wrong report, and the kind
 * that only gets noticed when someone official asks.
 */

const HOUR = 3_600_000;
const DAY = 86_400_000;

const NOW = new Date('2026-08-25T00:00:00.000Z');
const JULY = new Date('2026-07-10T00:00:00.000Z');

function row(over: Partial<SlaReportRow> & { id: string }): SlaReportRow {
  return { createdAt: JULY, acknowledgedAt: null, resolvedAt: null, ...over };
}

describe('median', () => {
  it('is null with nothing to summarise', () => {
    expect(median([])).toBeNull();
  });

  it('takes the middle of an odd count', () => {
    expect(median([5, 1, 3])).toBe(3);
  });

  it('takes the lower middle of an even count', () => {
    // Stated rather than averaged, so "median hours" is always a value that
    // actually happened.
    expect(median([1, 2, 3, 4])).toBe(2);
  });
});

describe('monthKey', () => {
  it('is UTC, and zero-padded', () => {
    expect(monthKey(new Date('2026-01-05T23:30:00.000Z'))).toBe('2026-01');
  });
});

describe('summariseByMonth', () => {
  it('counts a complaint nobody ever touched as a miss, not an exclusion', () => {
    // The whole point. This complaint is 46 days old, unacknowledged and
    // unclosed; a "share of closed complaints closed in time" report would
    // score this month 100%.
    const months = summariseByMonth([row({ id: 'ignored' })], NOW);

    expect(months).toHaveLength(1);
    expect(months[0].received).toBe(1);
    expect(months[0].acknowledgementMissing).toBe(1);
    expect(months[0].disposalMissing).toBe(1);
    expect(months[0].stillOpen).toBe(1);
    expect(months[0].acknowledgementRate).toBe(0);
    expect(months[0].disposalRate).toBe(0);
  });

  it('counts one handled properly as in time on both clocks', () => {
    const months = summariseByMonth(
      [
        row({
          id: 'good',
          acknowledgedAt: new Date(JULY.getTime() + 3 * HOUR),
          resolvedAt: new Date(JULY.getTime() + 4 * DAY),
        }),
      ],
      NOW
    );

    expect(months[0].acknowledgedInTime).toBe(1);
    expect(months[0].disposedInTime).toBe(1);
    expect(months[0].acknowledgementRate).toBe(1);
    expect(months[0].stillOpen).toBe(0);
  });

  it('counts acknowledging late as late, not as met', () => {
    const months = summariseByMonth(
      [row({ id: 'late', acknowledgedAt: new Date(JULY.getTime() + (ACK_DEADLINE_HOURS + 1) * HOUR) })],
      NOW
    );

    expect(months[0].acknowledgedInTime).toBe(0);
    expect(months[0].acknowledgedLate).toBe(1);
    // Doing it eventually is not doing it in time.
    expect(months[0].acknowledgementRate).toBe(0);
  });

  it('treats the deadline itself as in time', () => {
    const months = summariseByMonth(
      [row({ id: 'exact', acknowledgedAt: new Date(JULY.getTime() + ACK_DEADLINE_HOURS * HOUR) })],
      NOW
    );
    // Forty-eight hours means within forty-eight hours, inclusive.
    expect(months[0].acknowledgedInTime).toBe(1);
  });

  it('does not count a young complaint as missing anything yet', () => {
    const yesterday = new Date(NOW.getTime() - 1 * DAY);
    const months = summariseByMonth([row({ id: 'young', createdAt: yesterday })], NOW);

    // Inside both windows: nothing has been missed, and it is still open.
    expect(months[0].acknowledgementMissing).toBe(0);
    expect(months[0].disposalMissing).toBe(0);
    expect(months[0].stillOpen).toBe(1);
  });

  it('files a complaint under the month it was received, not the month it closed', () => {
    // Otherwise a bad month is rescued by closing everything late in the next
    // one, which is exactly backwards.
    const months = summariseByMonth(
      [
        row({
          id: 'spans',
          createdAt: new Date('2026-06-28T00:00:00.000Z'),
          resolvedAt: new Date('2026-08-02T00:00:00.000Z'),
        }),
      ],
      NOW
    );

    expect(months).toHaveLength(1);
    expect(months[0].month).toBe('2026-06');
    // Closed 35 days after receipt: late.
    expect(months[0].disposedLate).toBe(1);
  });

  it('reports months newest first', () => {
    const months = summariseByMonth(
      [
        row({ id: 'a', createdAt: new Date('2026-06-01T00:00:00.000Z') }),
        row({ id: 'b', createdAt: new Date('2026-08-01T00:00:00.000Z') }),
        row({ id: 'c', createdAt: new Date('2026-07-01T00:00:00.000Z') }),
      ],
      NOW
    );
    expect(months.map((m) => m.month)).toEqual(['2026-08', '2026-07', '2026-06']);
  });

  it('reports medians over what actually happened', () => {
    const months = summariseByMonth(
      [
        row({ id: '1', acknowledgedAt: new Date(JULY.getTime() + 1 * HOUR) }),
        row({ id: '2', acknowledgedAt: new Date(JULY.getTime() + 5 * HOUR) }),
        row({ id: '3', acknowledgedAt: new Date(JULY.getTime() + 9 * HOUR) }),
      ],
      NOW
    );
    expect(months[0].medianHoursToAcknowledge).toBe(5);
    // Nothing disposed of, so there is no median to report rather than a zero.
    expect(months[0].medianDaysToDispose).toBeNull();
  });
});

describe('missesFor', () => {
  it('reports both misses when a complaint missed both deadlines', () => {
    // Acknowledging late does not excuse disposing late; the rules treat them
    // as separate obligations and so does this.
    const misses = missesFor(
      row({
        id: 'both',
        acknowledgedAt: new Date(JULY.getTime() + 100 * HOUR),
        resolvedAt: new Date(JULY.getTime() + 40 * DAY),
      }),
      NOW
    );

    expect(misses.map((m) => m.kind).sort()).toEqual(['ACKNOWLEDGEMENT', 'DISPOSAL']);
  });

  it('marks an unresolved miss as still open', () => {
    const misses = missesFor(row({ id: 'open' }), NOW);
    expect(misses.every((m) => m.stillOpen)).toBe(true);
    expect(misses).toHaveLength(2);
  });

  it('reports nothing for a complaint handled in time', () => {
    const misses = missesFor(
      row({
        id: 'fine',
        acknowledgedAt: new Date(JULY.getTime() + 2 * HOUR),
        resolvedAt: new Date(JULY.getTime() + (RESOLVE_DEADLINE_DAYS - 1) * DAY),
      }),
      NOW
    );
    expect(misses).toEqual([]);
  });

  it('says how late, in the unit each deadline is stated in', () => {
    const misses = missesFor(
      row({ id: 'units', acknowledgedAt: new Date(JULY.getTime() + (ACK_DEADLINE_HOURS + 6) * HOUR) }),
      NOW
    );
    expect(misses[0].lateBy).toBe(6); // hours, because the deadline is in hours
  });
});

describe('toCsv', () => {
  it('writes a header and one line per month', () => {
    const csv = toCsv(summariseByMonth([row({ id: 'x' })], NOW));
    const lines = csv.trim().split('\n');

    expect(lines[0]).toContain('acknowledgement_rate');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('2026-07');
  });

  it('leaves an absent median empty rather than writing zero', () => {
    // A zero median would read as "we closed everything instantly".
    const csv = toCsv(summariseByMonth([row({ id: 'x' })], NOW));
    expect(csv.trim().split('\n')[1].endsWith(',,')).toBe(true);
  });
});
