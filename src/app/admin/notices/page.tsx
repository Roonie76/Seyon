import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isCurrentUserAdmin } from '@/backend/lib/is-admin';
import { getNoticeQueue } from '@/backend/actions/notices';
import { ResendNoticeButton } from '@/frontend/components/admin/resend-notice';

/**
 * Every notice the marketplace has sent, and what happened to it.
 *
 * The seller's inbox has existed since notices did; nothing showed the other
 * side. You could prove a notice was sent and still not see, in one place,
 * which ones were never opened and which asked a question nobody answered.
 *
 * Three states matter and are shown as counts rather than buried in a list:
 * unread, awaiting a response, and past the date one was asked for.
 */

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Notices — Admin' };

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'awaiting', label: 'Awaiting a response' },
  { key: 'overdue', label: 'Overdue' },
  // The queue with a person waiting on the other end of it.
  { key: 'replied', label: 'Replied — not reviewed' },
] as const;

export default async function AdminNoticesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>;
}) {
  if (!(await isCurrentUserAdmin())) redirect('/');

  const sp = await searchParams;
  const res = await getNoticeQueue({ filter: sp.filter, page: sp.page });

  if ('error' in res) {
    return (
      <section className="px-4 py-10">
        <p role="alert" data-testid="notices-error" className="text-xs font-semibold text-red-600">{res.error}</p>
      </section>
    );
  }

  const { rows, total, page, pageCount, counts } = res.data;
  const filter = sp.filter ?? 'all';

  return (
    <section className="min-h-screen bg-white px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl">

        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-zinc-950">Notices</h1>
            <p className="mt-1 text-sm text-zinc-600">
              What sellers were told, and whether they read it.
            </p>
          </div>
          <Link href="/admin" className="text-xs font-bold text-[#A77F3A] hover:underline">← Admin</Link>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat
            label="Replied, not reviewed"
            value={counts.replied}
            testId="notice-count-replied"
            alarming={counts.replied > 0}
          />
          <Stat label="Unread" value={counts.unread} testId="notice-count-unread" />
          <Stat label="Awaiting a response" value={counts.awaiting} testId="notice-count-awaiting" />
          <Stat
            label="Past the response date"
            value={counts.overdue}
            testId="notice-count-overdue"
            alarming={counts.overdue > 0}
          />
        </div>

        <nav className="mb-4 flex flex-wrap gap-2" data-testid="notice-filters">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={`/admin/notices?filter=${f.key}`}
              data-testid={`notice-filter-${f.key}`}
              className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold ${
                filter === f.key
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-zinc-300 text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              {f.label}
            </Link>
          ))}
        </nav>

        <p className="mb-3 text-xs text-zinc-600" data-testid="notice-total">
          {total} notice{total === 1 ? '' : 's'}
        </p>

        {rows.length === 0 ? (
          <p data-testid="notices-empty" className="rounded-xl border border-zinc-200 p-6 text-center text-xs text-zinc-600">
            Nothing here.
          </p>
        ) : (
          <ul className="space-y-3" data-testid="notice-rows">
            {rows.map((n) => (
              <li
                key={n.id}
                data-testid="notice-row"
                className={`rounded-xl border p-4 ${n.overdue ? 'border-red-300 bg-red-50/40' : 'border-zinc-200'}`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-zinc-950">{n.subject}</span>
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-bold text-zinc-700">
                      {n.kind.replace(/_/g, ' ').toLowerCase()}
                    </span>
                    {n.overdue ? (
                      <span data-testid="notice-overdue-badge" className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-bold text-red-800">
                        no response
                      </span>
                    ) : null}
                  </div>
                  <span className="text-[11px] text-zinc-500">{n.sentAt.toLocaleString('en-IN')}</span>
                </div>

                <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-xs text-zinc-700">{n.body}</p>

                <p className="mt-2 text-[11px] text-zinc-600">
                  <Link href={`/admin/stores/${n.shopSlug}`} className="font-bold text-[#A77F3A] hover:underline">
                    {n.shopName}
                  </Link>
                  {n.actorName ? ` · sent by ${n.actorName}` : ''}
                </p>

                {/* Sent and delivered are separate facts, and conflating them
                    is how "we told them" becomes untrue. */}
                <p className="mt-1 text-[11px]" data-testid="notice-delivery">
                  <span className={n.readAt ? 'text-emerald-700' : 'text-zinc-600'}>
                    {n.readAt ? `Read ${n.readAt.toLocaleDateString('en-IN')}` : 'Not opened yet'}
                  </span>
                  <span className="text-zinc-400"> · </span>
                  <span className={n.emailedAt ? 'text-zinc-600' : 'text-amber-700'}>
                    {n.emailedAt ? `emailed ${n.emailedAt.toLocaleDateString('en-IN')}` : 'no email sent'}
                  </span>
                  {n.requiresResponse ? (
                    <>
                      <span className="text-zinc-400"> · </span>
                      <span className={n.respondedAt ? 'text-emerald-700' : n.overdue ? 'font-semibold text-red-700' : 'text-zinc-600'}>
                        {n.respondedAt
                          ? `answered ${n.respondedAt.toLocaleDateString('en-IN')}`
                          : n.respondBy
                            ? `response due ${n.respondBy.toLocaleDateString('en-IN')}`
                            : 'response asked for'}
                      </span>
                    </>
                  ) : null}
                </p>

                {n.response ? (
                  <p className="mt-2 rounded bg-zinc-50 p-2 text-[11px] text-zinc-700" data-testid="notice-response">
                    <span className="font-semibold">Seller replied:</span> {n.response}
                  </p>
                ) : null}

                <ResendNoticeButton noticeId={n.id} everEmailed={Boolean(n.emailedAt)} />
              </li>
            ))}
          </ul>
        )}

        {pageCount > 1 ? (
          <nav className="mt-5 flex items-center gap-2 text-xs">
            {page > 1 ? (
              <Link href={`/admin/notices?filter=${filter}&page=${page - 1}`} className="font-bold text-[#A77F3A]">← Previous</Link>
            ) : null}
            <span className="text-zinc-600">Page {page} of {pageCount}</span>
            {page < pageCount ? (
              <Link href={`/admin/notices?filter=${filter}&page=${page + 1}`} className="font-bold text-[#A77F3A]">Next →</Link>
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
    <div className={`rounded-xl border p-4 ${alarming ? 'border-red-300 bg-red-50/50' : 'border-zinc-200'}`}>
      <div
        data-testid={testId}
        className={`text-2xl font-black ${alarming ? 'text-red-700' : 'text-zinc-950'}`}
      >
        {value}
      </div>
      <div className="mt-1 text-[11px] font-semibold text-zinc-600">{label}</div>
    </div>
  );
}
