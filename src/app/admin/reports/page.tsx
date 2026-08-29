import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isCurrentUserAdmin } from '@/backend/lib/is-admin';
import { getComplaintQueue } from '@/backend/actions/complaints';
import { ComplaintActions } from '@/frontend/components/admin/complaint-actions';
import { REPORT_CATEGORY_LABELS, ACK_DEADLINE_HOURS, RESOLVE_DEADLINE_DAYS } from '@/shared/lib/complaints';
import { ReportCategory, ReportTarget } from '@prisma/client';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Complaints — Admin' };

const FILTERS = ['open', 'overdue', 'acknowledged', 'closed', 'all'] as const;

export default async function AdminComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; target?: string; page?: string }>;
}) {
  if (!(await isCurrentUserAdmin())) redirect('/');

  const sp = await searchParams;
  const res = await getComplaintQueue({
    status: sp.status,
    category: sp.category,
    target: sp.target,
    page: sp.page,
  });

  if ('error' in res) {
    return (
      <section className="px-4 py-10">
        <p role="alert" className="text-xs font-semibold text-red-600">{res.error}</p>
      </section>
    );
  }

  const { rows, total, page, pageCount, counts } = res.data;
  const status = sp.status ?? 'open';

  return (
    <section className="min-h-screen bg-white px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-zinc-950">Complaints</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Acknowledge within {ACK_DEADLINE_HOURS} hours, close within {RESOLVE_DEADLINE_DAYS} days.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/reports/performance"
              data-testid="nav-performance"
              className="text-xs font-bold text-[#A77F3A] hover:underline"
            >
              Performance
            </Link>
            <Link href="/admin" className="text-xs font-bold text-[#A77F3A] hover:underline">← Admin</Link>
          </div>
        </div>

        {/* The two numbers that mean something is wrong, made impossible to
            miss. Everything else on this page is detail. */}
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="Open" value={counts.open} testId="count-open" />
          <Stat
            label={`Past ${ACK_DEADLINE_HOURS}h, not acknowledged`}
            value={counts.overdueAck}
            testId="count-overdue-ack"
            alarming={counts.overdueAck > 0}
          />
          <Stat
            label={`Past ${RESOLVE_DEADLINE_DAYS}d, not closed`}
            value={counts.overdueResolve}
            testId="count-overdue-resolve"
            alarming={counts.overdueResolve > 0}
          />
        </div>

        <form method="GET" className="mb-5 flex flex-wrap gap-2">
          <select
            name="status"
            defaultValue={status}
            data-testid="complaint-filter"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-xs"
          >
            {FILTERS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            name="category"
            defaultValue={sp.category ?? ''}
            data-testid="complaint-category-filter"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-xs"
          >
            <option value="">All categories</option>
            {Object.values(ReportCategory).map((c) => (
              <option key={c} value={c}>{REPORT_CATEGORY_LABELS[c]}</option>
            ))}
          </select>
          <select
            name="target"
            defaultValue={sp.target ?? ''}
            data-testid="complaint-target-filter"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-xs"
          >
            <option value="">Store and reviews</option>
            {Object.values(ReportTarget).map((t) => (
              <option key={t} value={t}>{t === 'REVIEW' ? 'About a review' : 'About the store'}</option>
            ))}
          </select>
          <button type="submit" data-testid="complaint-filter-submit" className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-bold text-white">
            Apply
          </button>
        </form>

        <p className="mb-3 text-xs text-zinc-600" data-testid="complaint-total">
          {total} complaint{total === 1 ? '' : 's'}
        </p>

        {rows.length === 0 ? (
          <p data-testid="complaint-empty" className="rounded-xl border border-zinc-200 p-6 text-center text-xs text-zinc-600">
            Nothing here.
          </p>
        ) : (
          <ul className="space-y-3" data-testid="complaint-rows">
            {rows.map((r) => {
              const ackLate = r.sla.ackState === 'overdue' || r.sla.ackState === 'breached';
              return (
                <li
                  key={r.id}
                  data-testid="complaint-row"
                  className={`rounded-xl border p-4 ${ackLate ? 'border-red-300 bg-red-50/40' : 'border-zinc-200'}`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-zinc-950">{REPORT_CATEGORY_LABELS[r.category]}</span>
                      {r.severe ? (
                        <span data-testid="severe-badge" className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-800">
                          serious
                        </span>
                      ) : null}
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-bold text-zinc-700">{r.status}</span>
                      {r.targetType === 'REVIEW' ? (
                        <span data-testid="review-target-badge" className="rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-bold text-violet-800">
                          about a review{r.review?.isHidden ? ' · hidden' : ''}
                        </span>
                      ) : null}
                      {r.siblingOpenCount > 1 ? (
                        <span data-testid="pattern-badge" className="rounded bg-orange-100 px-1.5 py-0.5 text-[11px] font-bold text-orange-800">
                          {r.siblingOpenCount} open against this store
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="text-[11px] text-zinc-500">{r.createdAt.toLocaleString('en-IN')}</span>
                      <Link
                        href={`/admin/reports/${r.id}`}
                        data-testid="complaint-open"
                        className="text-[11px] font-bold text-[#A77F3A] hover:underline"
                      >
                        Open
                      </Link>
                    </div>
                  </div>

                  <p className="mt-2 whitespace-pre-wrap text-xs text-zinc-800">{r.reason}</p>

                  <p className="mt-2 text-[11px] text-zinc-600">
                    Store:{' '}
                    <Link href={`/admin/stores/${r.shopSlug}`} className="font-bold text-[#A77F3A] hover:underline">
                      {r.shopName}
                    </Link>
                    {r.shopIsSuspended ? ' · suspended' : ''}
                    {r.shopIsUnderReview ? ' · under review' : ''}
                    {' · '}reported by {r.reporterName ?? r.reporterEmail ?? 'a buyer'}
                  </p>

                  <p
                    data-testid="complaint-sla"
                    className={`mt-2 text-[11px] font-semibold ${ackLate ? 'text-red-700' : 'text-zinc-600'}`}
                  >
                    {r.acknowledgedAt
                      ? `Acknowledged ${r.acknowledgedAt.toLocaleString('en-IN')}${
                          r.sla.ackState === 'breached' ? ' — after the 48-hour deadline' : ''
                        }${r.acknowledgedByName ? ` by ${r.acknowledgedByName}` : ''}`
                      : r.sla.ackState === 'overdue'
                        ? `Not acknowledged — ${Math.abs(r.sla.hoursUntilAckDue)}h past the deadline`
                        : `Not acknowledged — ${r.sla.hoursUntilAckDue}h left`}
                    {r.resolvedAt ? ` · closed ${r.resolvedAt.toLocaleDateString('en-IN')}` : ''}
                  </p>

                  {r.resolutionNote ? (
                    <p className="mt-1 rounded bg-zinc-50 p-2 text-[11px] text-zinc-700" data-testid="complaint-resolution">
                      {r.resolutionNote}
                    </p>
                  ) : null}

                  <ComplaintActions
                    reportId={r.id}
                    acknowledged={Boolean(r.acknowledgedAt)}
                    closed={Boolean(r.resolvedAt)}
                  />
                </li>
              );
            })}
          </ul>
        )}

        {pageCount > 1 ? (
          <nav className="mt-5 flex items-center gap-2 text-xs">
            {page > 1 ? (
              <Link href={`/admin/reports?status=${status}&page=${page - 1}`} className="font-bold text-[#A77F3A]">← Previous</Link>
            ) : null}
            <span className="text-zinc-600">Page {page} of {pageCount}</span>
            {page < pageCount ? (
              <Link href={`/admin/reports?status=${status}&page=${page + 1}`} className="font-bold text-[#A77F3A]">Next →</Link>
            ) : null}
          </nav>
        ) : null}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  testId,
  alarming,
}: {
  label: string;
  value: number;
  testId: string;
  alarming?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${alarming ? 'border-red-300 bg-red-50' : 'border-zinc-200'}`}>
      <div data-testid={testId} className={`text-2xl font-black ${alarming ? 'text-red-700' : 'text-zinc-950'}`}>
        {value}
      </div>
      <div className="mt-0.5 text-[11px] font-semibold text-zinc-600">{label}</div>
    </div>
  );
}
