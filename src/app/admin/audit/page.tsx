import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isCurrentUserAdmin } from '@/backend/lib/is-admin';
import { getAuditLog } from '@/backend/actions/admin-audit-log';
import { ADMIN_ACTIONS } from '@/backend/lib/admin-audit';

/**
 * Everything every admin did.
 *
 * `auditTrailFor` shows one store's history on that store's page. Nothing
 * showed the whole log, which is the view worth having after something
 * surprising rather than before it.
 *
 * Read-only by construction: no control on this page edits or removes a row.
 */

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Audit log | Seyon Admin' };

const TARGET_TYPES = ['Shop', 'Product', 'User', 'Report', 'SellerKyc', 'Review', 'Notice'] as const;

/** Where a target of each type can be looked at, when it still exists. */
function targetHref(targetType: string, targetId: string): string | null {
  switch (targetType) {
    case 'User': return `/admin/access/${targetId}`;
    case 'Report': return `/admin/reports/${targetId}`;
    default: return null;
  }
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (!(await isCurrentUserAdmin())) redirect('/');

  const sp = await searchParams;
  const res = await getAuditLog({
    actorId: sp.actorId,
    action: sp.action,
    targetType: sp.targetType,
    from: sp.from,
    to: sp.to,
    cursor: sp.cursor,
  });

  if ('error' in res) {
    return (
      <section className="px-4 py-10">
        <p role="alert" data-testid="audit-error" className="text-xs font-semibold text-red-600">{res.error}</p>
        <Link href="/admin/audit" className="mt-2 inline-block text-xs font-bold text-[#A77F3A] hover:underline">
          Clear filters
        </Link>
      </section>
    );
  }

  const { rows, nextCursor, actors } = res.data;

  // The cursor is per-page, so "next" carries the filters forward and replaces
  // only the cursor.
  const nextParams = new URLSearchParams(
    Object.entries(sp).filter(([k, v]) => v && k !== 'cursor') as [string, string][]
  );
  if (nextCursor) nextParams.set('cursor', nextCursor);

  const filtered = Boolean(sp.actorId || sp.action || sp.targetType || sp.from || sp.to);

  return (
    <section className="min-h-[calc(100vh-4rem)] bg-white px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl">

        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-zinc-950">Audit log</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Every privileged action, newest first. Nothing here can be edited or removed.
            </p>
          </div>
          <Link href="/admin" className="text-xs font-bold text-[#A77F3A] hover:underline">← Admin</Link>
        </div>

        <form method="GET" className="mb-5 flex flex-wrap items-end gap-2">
          <Field label="Admin">
            <select name="actorId" defaultValue={sp.actorId ?? ''} data-testid="audit-actor-filter" className="rounded-lg border border-zinc-300 px-3 py-2 text-xs">
              <option value="">Anyone</option>
              {actors.map((a) => (
                <option key={a.id} value={a.id}>{a.name ?? a.email ?? a.id}</option>
              ))}
            </select>
          </Field>
          <Field label="Action">
            <select name="action" defaultValue={sp.action ?? ''} data-testid="audit-action-filter" className="rounded-lg border border-zinc-300 px-3 py-2 text-xs">
              <option value="">Any action</option>
              {Object.keys(ADMIN_ACTIONS).map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </Field>
          <Field label="Target">
            <select name="targetType" defaultValue={sp.targetType ?? ''} data-testid="audit-target-filter" className="rounded-lg border border-zinc-300 px-3 py-2 text-xs">
              <option value="">Anything</option>
              {TARGET_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="From">
            <input type="date" name="from" defaultValue={sp.from ?? ''} data-testid="audit-from" className="rounded-lg border border-zinc-300 px-3 py-2 text-xs" />
          </Field>
          <Field label="To">
            <input type="date" name="to" defaultValue={sp.to ?? ''} data-testid="audit-to" className="rounded-lg border border-zinc-300 px-3 py-2 text-xs" />
          </Field>
          <button type="submit" data-testid="audit-filter-submit" className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-bold text-white">
            Apply
          </button>
          {filtered ? (
            <Link href="/admin/audit" data-testid="audit-clear" className="px-2 py-2 text-xs font-bold text-[#A77F3A] hover:underline">
              Clear
            </Link>
          ) : null}
        </form>

        {rows.length === 0 ? (
          <p data-testid="audit-log-empty" className="rounded-xl border border-zinc-200 p-6 text-center text-xs text-zinc-600">
            {filtered ? 'Nothing matches those filters.' : 'Nothing recorded yet.'}
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200" data-testid="audit-log-rows">
            {rows.map((a) => {
              const href = targetHref(a.targetType, a.targetId);
              return (
                <li key={a.id} className="p-3" data-testid="audit-log-row">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-zinc-950" data-testid="audit-log-action">{a.action}</span>
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-700">
                        {a.targetType}
                      </span>
                      {href ? (
                        <Link href={href} className="text-[11px] font-bold text-[#A77F3A] hover:underline">
                          open
                        </Link>
                      ) : null}
                    </div>
                    <span className="text-[10px] text-zinc-500">{a.createdAt.toLocaleString('en-IN')}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-600" data-testid="audit-log-actor">
                    by {a.actorName ?? a.actorEmail ?? 'unknown'}
                  </p>
                  {a.reason ? (
                    <p className="mt-1 rounded bg-zinc-50 p-2 text-[11px] text-zinc-700" data-testid="audit-log-reason">
                      {a.reason}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {nextCursor ? (
          <nav className="mt-5 text-xs">
            <Link
              href={`/admin/audit?${nextParams.toString()}`}
              data-testid="audit-next"
              className="font-bold text-[#A77F3A] hover:underline"
            >
              Older →
            </Link>
          </nav>
        ) : null}

      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{label}</span>
      {children}
    </label>
  );
}
