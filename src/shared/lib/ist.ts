/**
 * Days, as an Indian seller counts them.
 *
 * The analytics chart bucketed with `setHours(0,0,0,0)` and formatted with
 * `toLocaleDateString('en-US')`, both of which use the Node process timezone —
 * UTC on Vercel. So every "day" ran 05:30 IST to 05:30 IST: a WhatsApp tap at
 * 01:00 was filed under yesterday, and a seller opening the dashboard at 07:00
 * saw a "today" bar missing its first five and a half hours while the previous
 * bar held five and a half hours of today.
 *
 * India observes no daylight saving and has not since 1945, so a fixed offset
 * is correct and stays correct — no timezone database required.
 *
 * The blog index already got this right, with the comment "in IST because that
 * is where the readers are". This is that decision, factored out.
 */

/** +05:30 in milliseconds. */
export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export const IST_TIME_ZONE = 'Asia/Kolkata';

/** The UTC instant at which the IST day containing `at` began. */
export function istDayStart(at: Date = new Date()): Date {
  const shifted = new Date(at.getTime() + IST_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - IST_OFFSET_MS);
}

/** `YYYY-MM-DD` for the IST day containing `at`. Used as a bucket key. */
export function istDayKey(at: Date): string {
  return new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** A short axis label — Indian formatting, for an Indian audience. */
export function istDayLabel(at: Date): string {
  return at.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: IST_TIME_ZONE,
  });
}

/**
 * The IST day starts for the last `days` days, oldest first, ending today.
 *
 * Returned as instants so they can go straight into a query, rather than as
 * local dates that would drift again on the way.
 */
export function lastIstDays(days: number, now: Date = new Date()): Date[] {
  const today = istDayStart(now);
  return Array.from({ length: days }, (_, i) =>
    new Date(today.getTime() - (days - 1 - i) * 86_400_000)
  );
}
