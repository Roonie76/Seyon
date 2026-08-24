import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isCurrentUserAdmin } from '@/backend/lib/is-admin';
import { searchStores } from '@/backend/actions/admin-stores';

// Reads the session and query params; never prerenderable.
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Stores | Seyon Admin' };

const STATUSES = ['all', 'listed', 'unlisted', 'suspended', 'verified', 'unverified'] as const;

export default async function AdminStoresPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  if (!(await isCurrentUserAdmin())) redirect('/');

  const sp = await searchParams;
  const res = await searchStores({ query: sp.q, status: sp.status, page: sp.page });

  if ('error' in res) {
    return (
      <section className="px-4 py-10">
        <p role="alert" className="text-xs font-semibold text-red-600">{res.error}</p>
      </section>
    );
  }

  const { rows, total, page, pageCount } = res.data;
  const q = sp.q ?? '';
  const status = sp.status ?? 'all';

  return (
    <section className="min-h-[calc(100vh-4rem)] bg-white px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-zinc-950">Stores</h1>
            <p className="mt-1 text-sm text-zinc-600" data-testid="store-count">
              {total} store{total === 1 ? '' : 's'}
            </p>
          </div>
          <Link href="/admin" className="text-xs font-bold text-[#A77F3A] hover:underline">← Admin</Link>
        </div>

        {/* A plain GET form: the search is shareable and bookmarkable, and the
            page keeps working with JavaScript disabled. */}
        <form method="GET" className="mb-5 flex flex-wrap gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            data-testid="store-search"
            placeholder="Store name, slug, owner email or WhatsApp number"
            className="min-w-64 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-xs"
          />
          <select
            name="status"
            defaultValue={status}
            data-testid="store-status"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-xs"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            type="submit"
            data-testid="store-search-submit"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800"
          >
            Search
          </button>
        </form>

        {rows.length === 0 ? (
          <p data-testid="store-empty" className="rounded-xl border border-zinc-200 p-6 text-center text-xs text-zinc-600">
            No stores match that.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 text-[10px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Store</th>
                  <th className="px-3 py-2">Owner</th>
                  <th className="px-3 py-2">State</th>
                  <th className="px-3 py-2 text-right">Products</th>
                  <th className="px-3 py-2 text-right">Reports</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody data-testid="store-rows">
                {rows.map((s) => (
                  <tr key={s.id} data-testid="store-row" className="border-t border-zinc-100">
                    <td className="px-3 py-2">
                      <div className="font-bold text-zinc-950">{s.name}</div>
                      <div className="text-[11px] text-zinc-500">/{s.slug}{s.city ? ` · ${s.city}` : ''}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-zinc-800">{s.legalName ?? s.ownerName ?? '—'}</div>
                      <div className="text-[11px] text-zinc-500">{s.ownerEmail ?? '—'}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {s.isSuspended ? <Pill tone="red">suspended</Pill> : null}
                        {!s.isListed ? <Pill tone="amber">unlisted</Pill> : null}
                        {s.isPaused ? <Pill tone="zinc">paused</Pill> : null}
                        {s.isVerified ? <Pill tone="green">verified</Pill> : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">{s.productCount}</td>
                    <td className="px-3 py-2 text-right">
                      {s.openReports > 0 ? <span className="font-bold text-red-600">{s.openReports}</span> : '0'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/admin/stores/${s.slug}`}
                        data-testid="store-open"
                        className="font-bold text-[#A77F3A] hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pageCount > 1 ? (
          <nav className="mt-4 flex items-center gap-2 text-xs" aria-label="Pagination">
            {page > 1 ? (
              <Link href={`/admin/stores?q=${encodeURIComponent(q)}&status=${status}&page=${page - 1}`} className="rounded border border-zinc-300 px-3 py-1.5 font-bold">
                Previous
              </Link>
            ) : null}
            <span className="text-zinc-600">Page {page} of {pageCount}</span>
            {page < pageCount ? (
              <Link href={`/admin/stores?q=${encodeURIComponent(q)}&status=${status}&page=${page + 1}`} className="rounded border border-zinc-300 px-3 py-1.5 font-bold">
                Next
              </Link>
            ) : null}
          </nav>
        ) : null}
      </div>
    </section>
  );
}

function Pill({ tone, children }: { tone: 'red' | 'amber' | 'green' | 'zinc'; children: React.ReactNode }) {
  const tones = {
    red: 'bg-red-50 text-red-700 border-red-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    zinc: 'bg-zinc-100 text-zinc-600 border-zinc-200',
  } as const;
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${tones[tone]}`}>
      {children}
    </span>
  );
}
