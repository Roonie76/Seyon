import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isCurrentUserAdmin } from '@/backend/lib/is-admin';
import { getSlaPerformance } from '@/backend/actions/sla-performance';
import { ACK_DEADLINE_HOURS, RESOLVE_DEADLINE_DAYS } from '@/shared/lib/complaints';

/**
 * How the marketplace actually did, month by month.
 *
 * The queue answers "what is late now". This answers the question the Consumer
 * Protection (E-Commerce) Rules put to a marketplace, which arrives as a
 * period rather than an instant.
 *
 * Read the note under the table before trusting a good number: the denominator
 * here is everything received, not everything closed, and that difference is
 * the whole reason this page is not simply a ratio of two counts.
 */

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Complaint performance | Seyon Admin' };

const RANGES = [3, 6, 12] as const;

export default async function SlaPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ months?: string }>;
}) {
  if (!(await isCurrentUserAdmin())) redirect('/');

  const sp = await searchParams;
  const res = await getSlaPerformance({ months: sp.months });

  if ('error' in res) {
    return (
      <section className="px-4 py-10">
        <p role="alert" data-testid="performance-error" className="text-xs font-semibold text-red-600">
          {res.error}
        </p>
      </section>
    );
  }

  const { months, misses, monthsCovered, generatedAt } = res.data;
  const openMisses = misses.filter((m) => m.stillOpen);

  return (
    <section className="min-h-[calc(100vh-4rem)] bg-white px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl">

        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-zinc-950">Complaint performance</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Acknowledge within {ACK_DEADLINE_HOURS} hours, dispose within {RESOLVE_DEADLINE_DAYS} days.
              By the month a complaint arrived.
            </p>
          </div>
          <Link href="/admin/reports" className="text-xs font-bold text-[#A77F3A] hover:underline">
            ← Complaints
          </Link>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/admin/reports/performance?months=${r}`}
              data-testid={`range-${r}`}
              className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold ${
                monthsCovered === r
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-zinc-300 text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              {r} months
            </Link>
          ))}
          <a
            href={`/admin/reports/performance/export?months=${monthsCovered}`}
            data-testid="performance-export"
            className="ml-auto rounded-lg border border-zinc-300 px-3 py-1.5 text-[11px] font-bold text-zinc-700 hover:bg-zinc-50"
          >
            Download CSV
          </a>
        </div>

        {months.length === 0 ? (
          <p data-testid="performance-empty" className="rounded-xl border border-zinc-200 p-6 text-center text-xs text-zinc-600">
            No complaints were received in this period.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200">
            <table className="w-full text-xs" data-testid="performance-table">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left">
                  <Th>Month</Th>
                  <Th right>Received</Th>
                  <Th right>Acknowledged in time</Th>
                  <Th right>Late</Th>
                  <Th right>Never</Th>
                  <Th right>Disposed in time</Th>
                  <Th right>Late</Th>
                  <Th right>Never</Th>
                  <Th right>Still open</Th>
                  <Th right>Median ack</Th>
                  <Th right>Median close</Th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {months.map((m) => (
                  <tr key={m.month} className="border-b border-zinc-100 last:border-0" data-testid="performance-row">
                    <td className="px-3 py-2 font-bold text-zinc-900">{m.month}</td>
                    <Td>{m.received}</Td>
                    <Td strong={m.acknowledgementRate === 1}>
                      {m.acknowledgedInTime}
                      {m.acknowledgementRate === null ? '' : ` (${Math.round(m.acknowledgementRate * 100)}%)`}
                    </Td>
                    <Td alarming={m.acknowledgedLate > 0}>{m.acknowledgedLate}</Td>
                    <Td alarming={m.acknowledgementMissing > 0}>{m.acknowledgementMissing}</Td>
                    <Td strong={m.disposalRate === 1}>
                      {m.disposedInTime}
                      {m.disposalRate === null ? '' : ` (${Math.round(m.disposalRate * 100)}%)`}
                    </Td>
                    <Td alarming={m.disposedLate > 0}>{m.disposedLate}</Td>
                    <Td alarming={m.disposalMissing > 0}>{m.disposalMissing}</Td>
                    <Td>{m.stillOpen}</Td>
                    <Td>{m.medianHoursToAcknowledge === null ? '—' : `${m.medianHoursToAcknowledge}h`}</Td>
                    <Td>{m.medianDaysToDispose === null ? '—' : `${m.medianDaysToDispose}d`}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Without this the numbers are open to a flattering misreading. */}
        <p className="mt-3 text-[11px] text-zinc-600" data-testid="performance-denominator-note">
          Percentages are of everything received that month, not of everything closed. A complaint
          nobody has touched counts against the month it arrived in, for both deadlines — which is
          why a month can show 0% while nothing appears in the &ldquo;late&rdquo; columns.
        </p>

        <div className="mt-6">
          <h2 className="mb-1 text-sm font-bold text-zinc-950">
            Missed deadlines{' '}
            <span className="text-zinc-500" data-testid="miss-count">({misses.length})</span>
          </h2>
          <p className="mb-3 text-[11px] text-zinc-600">
            {openMisses.length > 0
              ? `${openMisses.length} of these are still open — those are work, not history.`
              : 'All of these have since been dealt with.'}
          </p>

          {misses.length === 0 ? (
            <p data-testid="misses-empty" className="rounded-xl border border-zinc-200 p-6 text-center text-xs text-zinc-600">
              Nothing missed a deadline in this period.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200" data-testid="miss-rows">
              {misses.slice(0, 100).map((m, i) => (
                <li key={`${m.id}-${m.kind}-${i}`} className="p-3" data-testid="miss-row">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-zinc-950">
                        {m.kind === 'ACKNOWLEDGEMENT' ? 'Not acknowledged in time' : 'Not disposed of in time'}
                      </span>
                      {m.stillOpen ? (
                        <span data-testid="miss-open-badge" className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-800">
                          still open
                        </span>
                      ) : null}
                    </div>
                    <span className="text-[10px] tabular-nums text-zinc-500">
                      {m.lateBy}
                      {m.kind === 'ACKNOWLEDGEMENT' ? 'h' : 'd'} late
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-600">
                    {m.category} ·{' '}
                    <Link href={`/admin/stores/${m.shopSlug}`} className="font-bold text-[#A77F3A] hover:underline">
                      {m.shopName}
                    </Link>{' '}
                    · received {m.createdAt.toLocaleDateString('en-IN')} ·{' '}
                    <Link href={`/admin/reports/${m.id}`} className="font-bold text-[#A77F3A] hover:underline">
                      open complaint
                    </Link>
                  </p>
                </li>
              ))}
            </ul>
          )}
          {misses.length > 100 ? (
            <p className="mt-2 text-[11px] text-zinc-600">
              Showing the worst 100 of {misses.length}. The CSV has every month in full.
            </p>
          ) : null}
        </div>

        <p className="mt-6 text-[10px] text-zinc-400">
          Generated {generatedAt.toLocaleString('en-IN')} from complaint timestamps. Nothing here is
          stored or cached, so changing a deadline corrects every past month rather than only new ones.
        </p>

      </div>
    </section>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-zinc-500 ${right ? 'text-right' : ''}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  alarming,
  strong,
}: {
  children: React.ReactNode;
  alarming?: boolean;
  strong?: boolean;
}) {
  return (
    <td
      className={`px-3 py-2 text-right ${
        alarming ? 'font-semibold text-red-700' : strong ? 'font-semibold text-emerald-700' : 'text-zinc-800'
      }`}
    >
      {children}
    </td>
  );
}
