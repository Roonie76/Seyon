import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { isCurrentUserAdmin } from '@/backend/lib/is-admin';
import { getAccountDetail } from '@/backend/actions/admin-access';
import { RoleControl } from '@/frontend/components/admin/role-control';

/**
 * One account, and how it came to have the role it has.
 *
 * The overview answers "who is an admin". This answers "who made them one, when,
 * and what reason did they give" — which is the question that gets asked when an
 * admin account turns up that nobody remembers creating, and the one the
 * codebase could not answer at all until the audit table existed.
 *
 * Built on `getAccountAudit()`, which had been written and never called.
 */

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Account — Admin' };

export default async function AdminAccountPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  if (!(await isCurrentUserAdmin())) redirect('/');

  const { userId } = await params;
  const res = await getAccountDetail(userId);

  if ('error' in res) {
    if (res.error === 'Account not found.' || res.error === 'Invalid user id.') notFound();
    return (
      <section className="px-4 py-10">
        <p role="alert" className="text-xs font-semibold text-red-600">{res.error}</p>
      </section>
    );
  }

  const u = res.data;

  return (
    <section className="min-h-[calc(100vh-4rem)] bg-white px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-5">

        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-zinc-950" data-testid="account-name">
              {u.name ?? u.email ?? 'Account'}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-600">
              <span
                data-testid="account-role"
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                  u.role === 'ADMIN'
                    ? 'bg-red-100 text-red-800'
                    : u.role === 'SELLER'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-zinc-100 text-zinc-700'
                }`}
              >
                {u.role}
              </span>
              {u.isSelf ? (
                <span data-testid="account-self" className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
                  you
                </span>
              ) : null}
              <span>joined {u.createdAt.toLocaleDateString('en-IN')}</span>
            </p>
          </div>
          <Link href="/admin/access" className="text-xs font-bold text-[#A77F3A] hover:underline">
            ← Access
          </Link>
        </div>

        {u.isOnlyAdmin ? (
          <p data-testid="account-only-admin" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-[11px] font-semibold text-amber-900">
            This is the only admin account. It cannot be demoted — doing so would lock everyone
            out of the admin surface with no way back that did not involve editing the database
            by hand. Promote someone else first.
          </p>
        ) : null}

        <div className="rounded-xl border border-zinc-200 p-4" data-testid="account-details">
          <h2 className="mb-3 text-sm font-bold text-zinc-950">Account</h2>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
            <Row label="Email" value={u.email} testId="account-email" />
            <Row label="Phone" value={u.phone} />
            <Row label="Identity" value={u.kycStatus ?? 'Not started'} testId="account-kyc" />
            <Row
              label="Store"
              value={u.shop ? u.shop.name : null}
              testId="account-store"
              href={u.shop ? `/admin/stores/${u.shop.slug}` : undefined}
              suffix={
                u.shop
                  ? [u.shop.isSuspended ? 'suspended' : null, u.shop.isUnderReview ? 'under review' : null]
                      .filter(Boolean)
                      .join(' · ') || undefined
                  : undefined
              }
            />
            <Row label="Reviews written" value={String(u.reviewCount)} />
            <Row label="Reports filed" value={String(u.reportCount)} />
          </dl>
        </div>

        <div className="rounded-xl border border-zinc-200 p-4">
          <h2 className="mb-3 text-sm font-bold text-zinc-950">Role</h2>
          <RoleControl
            userId={u.id}
            email={u.email}
            currentRole={u.role}
            isSelf={u.isSelf}
            isLastAdmin={u.isOnlyAdmin}
          />
        </div>

        {/* The point of the page. */}
        <div className="rounded-xl border border-zinc-200 p-4">
          <h2 className="mb-3 text-sm font-bold text-zinc-950">Role history</h2>
          {u.audit.length === 0 ? (
            <p data-testid="account-audit-empty" className="text-xs text-zinc-600">
              No recorded change. This account has held {u.role} since it was created, or was
              changed before the audit log existed.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100 text-xs" data-testid="account-audit">
              {u.audit.map((a) => (
                <li key={a.id} className="py-2" data-testid="account-audit-row">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-bold text-zinc-900" data-testid="account-audit-action">{a.action}</span>
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
  href,
  suffix,
}: {
  label: string;
  value: string | null;
  testId?: string;
  href?: string;
  suffix?: string;
}) {
  return (
    <div className="flex gap-2">
      <dt className="min-w-28 font-semibold text-zinc-500">{label}</dt>
      <dd className="text-zinc-900" data-testid={testId}>
        {value === null ? (
          '—'
        ) : href ? (
          <Link href={href} className="font-bold text-[#A77F3A] hover:underline">{value}</Link>
        ) : (
          value
        )}
        {suffix ? <span className="ml-2 text-zinc-500">{suffix}</span> : null}
      </dd>
    </div>
  );
}
