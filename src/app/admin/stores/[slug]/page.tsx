import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { isCurrentUserAdmin } from '@/backend/lib/is-admin';
import { getStoreDetail } from '@/backend/actions/admin-stores';
import { getShopReviewsForModeration } from '@/backend/actions/moderation';
import { getShopNotices } from '@/backend/actions/notices';
import { StoreActions, DeleteProductButton, DeleteStoreButton } from '@/frontend/components/admin/store-actions';
import { StoreRepair } from '@/frontend/components/admin/store-repair';
import { ReviewModeration } from '@/frontend/components/admin/review-moderation';
import { UnderReviewControl, StoreNotices } from '@/frontend/components/admin/store-notices';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Store — Admin' };

export default async function AdminStoreDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!(await isCurrentUserAdmin())) redirect('/');

  const { slug } = await params;
  const res = await getStoreDetail(slug);
  if ('error' in res) {
    if (res.error === 'Store not found.') notFound();
    return (
      <section className="px-4 py-10">
        <p role="alert" className="text-xs font-semibold text-red-600">{res.error}</p>
      </section>
    );
  }
  const s = res.data;

  // Reviews and notices are fetched here rather than folded into
  // getStoreDetail: both are their own moderation surfaces with their own
  // authorisation, and one query returning everything about a store was how
  // the old admin dashboard ended up loading the entire marketplace.
  const [reviewRes, noticeRes] = await Promise.all([
    getShopReviewsForModeration(s.id),
    getShopNotices(s.id),
  ]);

  return (
    <section className="min-h-[calc(100vh-4rem)] bg-white px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-zinc-950" data-testid="store-name">{s.name}</h1>
            <p className="mt-1 text-sm text-zinc-600">
              /{s.slug}
              {s.city ? ` · ${s.city}` : ''} · created {s.createdAt.toLocaleDateString('en-IN')}
            </p>
          </div>
          <Link href="/admin/stores" className="text-xs font-bold text-[#A77F3A] hover:underline">← Stores</Link>
        </div>

        {/* Who the seller actually is — the thing an admin opens this page for. */}
        <div className="rounded-xl border border-zinc-200 p-4" data-testid="owner-details">
          <h2 className="mb-3 text-sm font-bold text-zinc-950">Owner</h2>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
            <Row label="Legal name" value={s.legalName} testId="owner-legal-name" />
            <Row label="Account name" value={s.ownerName} />
            <Row label="Email" value={s.ownerEmail} testId="owner-email" />
            <Row label="Phone" value={s.ownerPhone} />
            <Row label="WhatsApp" value={s.whatsapp} />
            <Row label="Address" value={s.ownerAddress} />
            <Row label="Joined" value={s.ownerJoinedAt.toLocaleDateString('en-IN')} />
            <Row label="Identity" value={s.kycStatus ?? 'Not started'} testId="owner-kyc" />
          </dl>
        </div>

        <StoreActions shopId={s.id} slug={s.slug} isVerified={s.isVerified} isSuspended={s.isSuspended} />

        <div className="rounded-xl border border-zinc-200 p-4">
          <h2 className="text-sm font-bold text-zinc-950">Details</h2>
          <p className="mt-1 text-[11px] text-zinc-600">
            For correcting a mistake, not for renaming on request.
          </p>
          <StoreRepair shopId={s.id} slug={s.slug} whatsapp={s.whatsapp} />
        </div>

        <UnderReviewControl
          shopId={s.id}
          isUnderReview={s.isUnderReview}
          reason={s.underReviewReason}
          since={s.underReviewSince}
        />

        {'error' in reviewRes ? (
          <p role="alert" className="text-xs font-semibold text-red-600">{reviewRes.error}</p>
        ) : (
          <ReviewModeration reviews={reviewRes.data} />
        )}

        {'error' in noticeRes ? (
          <p role="alert" className="text-xs font-semibold text-red-600">{noticeRes.error}</p>
        ) : (
          <StoreNotices shopId={s.id} notices={noticeRes.data} />
        )}

        <div className="rounded-xl border border-zinc-200 p-4">
          <h2 className="mb-3 text-sm font-bold text-zinc-950">
            Products <span className="text-zinc-500">({s.productCount})</span>
          </h2>
          {s.products.length === 0 ? (
            <p className="text-xs text-zinc-600">No products.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 text-xs" data-testid="product-list">
              {s.products.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 py-2">
                  <div>
                    <div className="font-semibold text-zinc-900">{p.title}</div>
                    <div className="text-[11px] text-zinc-500">₹{p.price} · {p.status}</div>
                  </div>
                  <div className="w-48 shrink-0 text-right">
                    <DeleteProductButton productId={p.id} title={p.title} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-zinc-200 p-4">
          <h2 className="mb-3 text-sm font-bold text-zinc-950">
            Reports <span className="text-zinc-500">({s.openReports} open)</span>
          </h2>
          {s.reports.length === 0 ? (
            <p className="text-xs text-zinc-600">No reports.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 text-xs">
              {s.reports.map((r) => (
                <li key={r.id} className="py-2">
                  <div className="font-semibold text-zinc-900">{r.status}</div>
                  <div className="text-[11px] text-zinc-600">{r.reason}</div>
                  <div className="text-[11px] text-zinc-400">{r.createdAt.toLocaleString('en-IN')}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* The record that did not exist before: who did what to this store. */}
        <div className="rounded-xl border border-zinc-200 p-4">
          <h2 className="mb-3 text-sm font-bold text-zinc-950">Admin history</h2>
          {s.audit.length === 0 ? (
            <p data-testid="audit-empty" className="text-xs text-zinc-600">Nothing recorded yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 text-xs" data-testid="audit-trail">
              {s.audit.map((a) => (
                <li key={a.id} className="py-2" data-testid="audit-entry">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-bold text-zinc-900" data-testid="audit-action">{a.action}</span>
                    <span className="text-[11px] text-zinc-400">{a.createdAt.toLocaleString('en-IN')}</span>
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
        <DeleteStoreButton
          shopId={s.id}
          slug={s.slug}
          name={s.name}
          productCount={s.productCount}
        />

      </div>
    </section>
  );
}

function Row({ label, value, testId }: { label: string; value: string | null; testId?: string }) {
  return (
    <div className="flex gap-2">
      <dt className="min-w-28 font-semibold text-zinc-500">{label}</dt>
      <dd className="text-zinc-900" data-testid={testId}>{value ?? '—'}</dd>
    </div>
  );
}
