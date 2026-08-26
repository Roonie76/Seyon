'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { approveKyc, rejectKyc, getKycDocumentUrl, type KycQueueItem } from '@/backend/actions/kyc-review';
import { runAction } from '@/frontend/lib/run-action';

/**
 * The identity review queue.
 *
 * Oldest first, and the age is shown in hours rather than a date, because the
 * question a reviewer actually has is "how long has this person been waiting",
 * not "what day was it".
 *
 * Rejecting requires typing a reason. The button stays disabled until there is
 * one — the server and a database CHECK both enforce the same rule, but making
 * it impossible in the UI means a reviewer never hits the error at all.
 */
export function KycQueue({ items }: { items: KycQueueItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [rejectingId, setRejectingId] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  async function onApprove(id: string) {
    setBusyId(id);
    setError(null);
    const res = await runAction(() => approveKyc({ kycId: id }));
    if (!('success' in res)) setError(res.error ?? 'Could not approve.');
    setBusyId(null);
    router.refresh();
  }

  async function onReject(id: string) {
    setBusyId(id);
    setError(null);
    const res = await runAction(() => rejectKyc({ kycId: id, reason }));
    if (!('success' in res)) {
      setError(res.error ?? 'Could not reject.');
      setBusyId(null);
      return;
    }
    setRejectingId(null);
    setReason('');
    setBusyId(null);
    router.refresh();
  }

  async function onViewDocument(id: string) {
    setError(null);
    const res = await runAction(() => getKycDocumentUrl(id));
    if (!('url' in res)) {
      setError(res.error ?? 'Could not open the document.');
      return;
    }
    window.open(res.url, '_blank', 'noopener,noreferrer');
  }

  if (items.length === 0) {
    return (
      <p data-testid="kyc-queue-empty" className="rounded-xl border border-zinc-200 p-6 text-center text-xs text-zinc-600">
        Nothing waiting for review.
      </p>
    );
  }

  return (
    <div className="space-y-3" data-testid="kyc-queue">
      {error ? (
        <p role="alert" data-testid="kyc-queue-error" className="text-xs font-semibold text-red-600">
          {error}
        </p>
      ) : null}

      {items.map((item) => (
        <article key={item.id} data-testid="kyc-case" className="rounded-xl border border-zinc-200 p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-zinc-950" data-testid="kyc-legal-name">
                {item.legalName ?? 'No name given'}
              </h3>
              <p className="text-[11px] text-zinc-600">
                {item.shopName ?? 'No store'}
                {item.shopSlug ? ` · /store/${item.shopSlug}` : ''} · {item.ownerEmail ?? 'no email'}
              </p>
            </div>
            {item.ageHours !== null ? (
              <span
                className={
                  item.ageHours >= 48
                    ? 'rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[11px] font-bold text-red-700'
                    : 'rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-600'
                }
              >
                waiting {item.ageHours}h
              </span>
            ) : null}
          </div>

          <dl className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-zinc-700 sm:grid-cols-3">
            <div><dt className="inline font-semibold">Type: </dt><dd className="inline">{item.idType ?? '—'}</dd></div>
            <div><dt className="inline font-semibold">Ends: </dt><dd className="inline" data-testid="kyc-last4">{item.idLast4 ?? '—'}</dd></div>
            <div><dt className="inline font-semibold">GSTIN: </dt><dd className="inline">{item.gstin ?? '—'}</dd></div>
          </dl>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="kyc-view-doc"
              onClick={() => onViewDocument(item.id)}
              disabled={!item.hasDocument}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-[11px] font-bold text-zinc-800 hover:bg-zinc-50 disabled:opacity-40"
            >
              {item.hasDocument ? 'View document' : 'No document'}
            </button>
            <button
              type="button"
              data-testid="kyc-approve"
              onClick={() => onApprove(item.id)}
              disabled={busyId === item.id}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
            >
              Approve
            </button>
            <button
              type="button"
              data-testid="kyc-reject-open"
              onClick={() => { setRejectingId(item.id); setReason(''); }}
              disabled={busyId === item.id}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-50 disabled:opacity-40"
            >
              Reject
            </button>
          </div>

          {rejectingId === item.id ? (
            <div className="mt-3 space-y-2">
              <label className="block text-[11px] font-bold text-zinc-700" htmlFor={`reason-${item.id}`}>
                Why? The seller sees this, so make it something they can act on.
              </label>
              <textarea
                id={`reason-${item.id}`}
                data-testid="kyc-reject-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  data-testid="kyc-reject-confirm"
                  onClick={() => onReject(item.id)}
                  disabled={reason.trim().length < 10 || busyId === item.id}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-red-700 disabled:opacity-40"
                >
                  Confirm rejection
                </button>
                <button
                  type="button"
                  onClick={() => setRejectingId(null)}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-[11px] font-bold text-zinc-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}
