import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isCurrentUserAdmin } from '@/backend/lib/is-admin';
import { getAccessOverview } from '@/backend/actions/admin-access';
import { RoleControl } from '@/frontend/components/admin/role-control';
import { Role } from '@prisma/client';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Access — Admin' };

export default async function AdminAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; page?: string }>;
}) {
  if (!(await isCurrentUserAdmin())) redirect('/');

  const sp = await searchParams;
  const role = sp.role && sp.role in Role ? (sp.role as Role) : undefined;
  const res = await getAccessOverview({ query: sp.q, role, page: sp.page });

  if ('error' in res) {
    return (
      <section className="px-4 py-10">
        <p role="alert" className="text-xs font-semibold text-red-600">{res.error}</p>
      </section>
    );
  }

  const { rows, total, page, pageCount, adminCount, recentChanges } = res.data;

  return (
    <section className="min-h-screen bg-white px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-zinc-950">Access</h1>
            <p className="mt-1 text-sm text-zinc-600" data-testid="admin-count">
              {adminCount} admin{adminCount === 1 ? '' : 's'} · {total} account{total === 1 ? '' : 's'} matching
            </p>
          </div>
          <Link href="/admin" className="text-xs font-bold text-[#A77F3A] hover:underline">← Admin</Link>
        </div>

        {adminCount === 1 ? (
          <p data-testid="single-admin-warning" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[11px] font-semibold text-amber-900">
            There is one admin account. It cannot be demoted, because doing so would lock everyone
            out of this screen. Promote a second person before you need to.
          </p>
        ) : null}

        <form method="GET" className="mb-5 flex flex-wrap gap-2">
          <input
            type="search"
            name="q"
            defaultValue={sp.q ?? ''}
            data-testid="access-search"
            placeholder="Name or email"
            className="min-w-64 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-xs"
          />
          <select name="role" defaultValue={sp.role ?? ''} data-testid="access-role-filter" className="rounded-lg border border-zinc-300 px-3 py-2 text-xs">
            <option value="">All roles</option>
            {Object.values(Role).map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <button type="submit" data-testid="access-search-submit" className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-bold text-white">
            Search
          </button>
        </form>

        {rows.length === 0 ? (
          <p data-testid="access-empty" className="rounded-xl border border-zinc-200 p-6 text-center text-xs text-zinc-600">
            No accounts match.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200" data-testid="access-rows">
            {rows.map((u) => (
              <li key={u.id} data-testid="access-row" className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/access/${u.id}`}
                      data-testid="access-open"
                      className="truncate text-sm font-bold text-zinc-950 hover:text-[#A77F3A] hover:underline"
                    >
                      {u.name ?? '(no name)'}
                    </Link>
                    <span
                      data-testid="access-role"
                      className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
                        u.role === 'ADMIN' ? 'bg-red-100 text-red-800' : 'bg-zinc-100 text-zinc-700'
                      }`}
                    >
                      {u.role}
                    </span>
                    {u.isSelf ? (
                      <span data-testid="access-self" className="rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-bold text-blue-800">you</span>
                    ) : null}
                  </div>
                  <div className="truncate text-[11px] text-zinc-600">
                    {u.email ?? '(no email)'}
                    {u.shopSlug ? (
                      <>
                        {' · '}
                        <Link href={`/admin/stores/${u.shopSlug}`} className="font-bold text-[#A77F3A] hover:underline">
                          store
                        </Link>
                      </>
                    ) : null}
                    {' · joined '}{u.createdAt.toLocaleDateString('en-IN')}
                  </div>
                </div>
                <RoleControl
                  userId={u.id}
                  email={u.email}
                  currentRole={u.role}
                  isSelf={u.isSelf}
                  isLastAdmin={u.role === 'ADMIN' && adminCount <= 1}
                />
              </li>
            ))}
          </ul>
        )}

        {pageCount > 1 ? (
          <nav className="mt-4 flex items-center gap-2 text-xs">
            {page > 1 ? <Link href={`/admin/access?page=${page - 1}`} className="font-bold text-[#A77F3A]">← Previous</Link> : null}
            <span className="text-zinc-600">Page {page} of {pageCount}</span>
            {page < pageCount ? <Link href={`/admin/access?page=${page + 1}`} className="font-bold text-[#A77F3A]">Next →</Link> : null}
          </nav>
        ) : null}

        {/* Every role change ever made, so a privilege escalation is visible
            rather than being something you would have to know to look for. */}
        <div className="mt-8 rounded-xl border border-zinc-200 p-4">
          <h2 className="mb-3 text-sm font-bold text-zinc-950">Role changes</h2>
          {recentChanges.length === 0 ? (
            <p data-testid="role-history-empty" className="text-xs text-zinc-600">Nothing recorded yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 text-xs" data-testid="role-history">
              {recentChanges.map((c) => (
                <li key={c.id} className="py-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-bold text-zinc-900" data-testid="role-history-action">{c.action}</span>
                    <span className="text-[11px] text-zinc-400">{c.createdAt.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="text-[11px] text-zinc-600">
                    by {c.actorName ?? c.actorEmail ?? 'unknown'}
                    {c.reason ? ` — ${c.reason}` : ''}
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
