import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { isCurrentUserAdmin } from '@/backend/lib/is-admin';
import { getComplaint } from '@/backend/actions/complaints';
import { ComplaintActions } from '@/frontend/components/admin/complaint-actions';
import { ComplaintReviewTargetCard } from '@/frontend/components/admin/complaint-review-target';
import {
  REPORT_CATEGORY_LABELS,
  ACK_DEADLINE_HOURS,
  RESOLVE_DEADLINE_DAYS,
} from '@/shared/lib/complaints';

/**
 * One complaint, with everything needed to decide what to do about it.
 *
 * The queue answers "what is waiting". This answers "what happened here", which
 * is a different question and the one that matters when a seller disputes the
 * outcome: what was alleged, when we acknowledged it, who acknowledged it, what
 * else has been said about this store, and every admin action taken since.
 *
 * `getComplaint()` has existed and been unreachable — this is the page it was
 * written for.
 */

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Complaint | Seyon Admin' };

export default async function AdminComplaintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isCurrentUserAdmin())) redirect('/');

  const { id } = await params;
  const res = await getComplaint(id);

  if ('error' in res) {
    if (res.error === 'Report not found.' || res.error === 'Invalid report id.') notFound();
    return (
      <section className="px-4 py-10">
        <p role="alert" className="text-xs font-semibold text-red-600">{res.error}</p>
      </section>
    );
  }

  const c = res.data;
  const ackLate = c.sla.ackState === 'overdue' || c.sla.ackState === 'breached';
  const closed = Boolean(c.resolvedAt);

  return (
    <section className="min-h-[calc(100vh-4rem)] bg-white px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-5">

        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-zinc-950" data-testid="complaint-category">
              {REPORT_CATEGORY_LABELS[c.category]}
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Received {c.createdAt.toLocaleString('en-IN')} · {c.status}
            </p>
            <p className="mt-1 text-xs font-semibold text-zinc-700" data-testid="complaint-target-type">
              {c.targetType === 'REVIEW' ? 'About a review' : 'About the store'}
            </p>
          </div>
          <Link href="/admin/reports" className="text-xs font-bold text-[#A77F3A] hover:underline">
            ← Complaints
          </Link>
        </div>

        {/* Both clocks, stated rather than implied. The second one is the
            obligation people forget: acknowledging in time does not stop the
            thirty-day disposal deadline from running. */}
        <div
          data-testid="complaint-sla-detail"
          className={`rounded-xl border p-4 text-xs ${ackLate ? 'border-red-300 bg-red-50/50' : 'border-zinc-200'}`}
        >
          <h2 className="mb-2 text-sm font-bold text-zinc-950">Deadlines</h2>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            <Row
              label={`Acknowledge (${ACK_DEADLINE_HOURS}h)`}
              testId="sla-ack"
              value={
                c.acknowledgedAt
                  ? `${c.acknowledgedAt.toLocaleString('en-IN')}${
                      c.sla.ackState === 'breached' ? ' — late' : ' — in time'
                    }${c.acknowledgedByName ? `, by ${c.acknowledgedByName}` : ''}`
                  : c.sla.ackState === 'overdue'
                    ? `Not acknowledged — ${Math.abs(c.sla.hoursUntilAckDue)}h past the deadline`
                    : `Not acknowledged — ${c.sla.hoursUntilAckDue}h left`
              }
              alarming={ackLate && !c.acknowledgedAt}
            />
            <Row
              label={`Close (${RESOLVE_DEADLINE_DAYS}d)`}
              testId="sla-resolve"
              value={
                c.resolvedAt
                  ? `${c.resolvedAt.toLocaleDateString('en-IN')}${
                      c.sla.resolveState === 'breached' ? ' — late' : ' — in time'
                    }`
                  : c.sla.resolveState === 'overdue'
                    ? `Still open — ${Math.abs(c.sla.daysUntilResolveDue)}d past the deadline`
                    : `Still open — ${c.sla.daysUntilResolveDue}d left`
              }
              alarming={!closed && c.sla.resolveState === 'overdue'}
            />
          </dl>
        </div>

        <div className="rounded-xl border border-zinc-200 p-4">
          <h2 className="mb-2 text-sm font-bold text-zinc-950">What was reported</h2>
          <p className="whitespace-pre-wrap text-xs text-zinc-800" data-testid="complaint-reason">
            {c.reason}
          </p>
          <p className="mt-3 text-[11px] text-zinc-600" data-testid="complaint-reporter">
            Reported by {c.reporterName ?? c.reporterEmail ?? 'a buyer'}
            {c.reporterName && c.reporterEmail ? ` (${c.reporterEmail})` : ''}
          </p>
          {c.severe ? (
            <p data-testid="complaint-severe" className="mt-2 rounded bg-amber-50 p-2 text-[11px] font-semibold text-amber-900">
              This category is one where the store itself is worth looking at, not just the complaint.
              Nothing has been done automatically — an accusation is not a finding.
            </p>
          ) : null}
        </div>

        {c.review ? (
          <ComplaintReviewTargetCard review={c.review} suggestedReason={c.reason} />
        ) : null}

        <div className="rounded-xl border border-zinc-200 p-4">
          <h2 className="mb-2 text-sm font-bold text-zinc-950">Store</h2>
          <p className="text-xs">
            <Link
              href={`/admin/stores/${c.shopSlug}`}
              data-testid="complaint-store-link"
              className="font-bold text-[#A77F3A] hover:underline"
            >
              {c.shopName}
            </Link>
            {c.shopIsSuspended ? <span className="ml-2 text-zinc-600">suspended</span> : null}
            {c.shopIsUnderReview ? <span className="ml-2 text-zinc-600">under review</span> : null}
          </p>

          {c.shopOpenComplaints.length === 0 ? (
            <p data-testid="siblings-empty" className="mt-3 text-[11px] text-zinc-600">
              No other complaints about this store.
            </p>
          ) : (
            <>
              <p className="mt-3 text-[11px] font-semibold text-zinc-700" data-testid="siblings-heading">
                {c.shopOpenComplaints.length} other complaint
                {c.shopOpenComplaints.length === 1 ? '' : 's'} about this store
                {c.siblingOpenCount > 0 ? ` · ${c.siblingOpenCount} still open` : ''}
              </p>
              <ul className="mt-1 divide-y divide-zinc-100 text-[11px]" data-testid="sibling-list">
                {c.shopOpenComplaints.map((o) => (
                  <li key={o.id} className="py-1.5" data-testid="sibling-row">
                    <Link href={`/admin/reports/${o.id}`} className="font-semibold text-zinc-900 hover:underline">
                      {REPORT_CATEGORY_LABELS[o.category]}
                    </Link>
                    <span className="ml-2 text-zinc-500">
                      {o.status} · {o.createdAt.toLocaleDateString('en-IN')}
                    </span>
                    <p className="line-clamp-1 text-zinc-600">{o.reason}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {closed ? (
          <div className="rounded-xl border border-zinc-200 p-4" data-testid="complaint-outcome">
            <h2 className="mb-2 text-sm font-bold text-zinc-950">
              Closed — {c.status === 'RESOLVED' ? 'action taken' : 'nothing found'}
            </h2>
            <p className="whitespace-pre-wrap rounded bg-zinc-50 p-2 text-xs text-zinc-700">
              {c.resolutionNote ?? '—'}
            </p>
            <p className="mt-2 text-[10px] text-zinc-500">The person who reported it was sent this.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 p-4">
            <h2 className="mb-1 text-sm font-bold text-zinc-950">Act on it</h2>
            <ComplaintActions
              reportId={c.id}
              acknowledged={Boolean(c.acknowledgedAt)}
              closed={closed}
            />
          </div>
        )}

        <div className="rounded-xl border border-zinc-200 p-4">
          <h2 className="mb-3 text-sm font-bold text-zinc-950">Admin history</h2>
          {c.audit.length === 0 ? (
            <p data-testid="complaint-audit-empty" className="text-xs text-zinc-600">Nothing recorded yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 text-xs" data-testid="complaint-audit">
              {c.audit.map((a) => (
                <li key={a.id} className="py-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-bold text-zinc-900" data-testid="complaint-audit-action">{a.action}</span>
                    <span className="text-[10px] text-zinc-400">{a.createdAt.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="text-[11px] text-zinc-600">
                    by {a.actorName ?? a.actorEmail ?? 'unknown'}
                    {a.reason ? ` — ${a.reason}` : ''}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </section>
  );
}

function Row({
  label,
  value,
  testId,
  alarming,
}: {
  label: string;
  value: string;
  testId: string;
  alarming?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <dt className="min-w-32 font-semibold text-zinc-500">{label}</dt>
      <dd className={alarming ? 'font-semibold text-red-700' : 'text-zinc-900'} data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}
