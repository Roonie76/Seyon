'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { NoticeKind } from '@prisma/client';
import { sendNoticeAction, type SellerNotice } from '@/backend/actions/notices';
import { setShopUnderReviewAction } from '@/backend/actions/moderation';
import { runAction } from '@/frontend/lib/run-action';

/**
 * Putting a store under review, and writing to its owner.
 *
 * These sit together because they are the two things you do when something is
 * wrong but not proven. Suspension is the third, and it is deliberately
 * elsewhere on the page: it ends someone's trading, and reaching it should take
 * a moment longer than the other two.
 */

const KIND_LABELS: Record<NoticeKind, string> = {
  WARNING: 'Warning',
  POLICY_VIOLATION: 'Policy violation',
  INFORMATION_REQUEST: 'Request for information',
  SUSPENSION: 'Suspension',
  REINSTATEMENT: 'Reinstatement',
};

export function UnderReviewControl({
  shopId,
  isUnderReview,
  reason: currentReason,
  since,
}: {
  shopId: string;
  isUnderReview: boolean;
  reason: string | null;
  since: Date | null;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function set(next: boolean) {
    setBusy(true); setError(null);
    const res = await runAction(() => setShopUnderReviewAction(shopId, next, next ? reason : undefined));
    if (!('success' in res)) { setError(res.error ?? 'Failed.'); setBusy(false); return; }
    setOpen(false); setReason(''); setBusy(false); router.refresh();
  }

  return (
    <div className="rounded-xl border border-zinc-200 p-4" data-testid="under-review-control">
      <h2 className="mb-1 text-sm font-bold text-zinc-950">Under review</h2>
      <p className="mb-3 text-[11px] text-zinc-600">
        Removes the store from the marketplace, search and category pages. Direct links keep working
        and nothing is shown to shoppers. The seller is not told — this is for an accusation you have
        not tested yet.
      </p>

      {error ? (
        <p role="alert" data-testid="under-review-error" className="mb-2 text-[11px] font-semibold text-red-600">{error}</p>
      ) : null}

      {isUnderReview ? (
        <>
          <p className="mb-2 rounded bg-amber-50 p-2 text-[11px] text-amber-900" data-testid="under-review-status">
            Under review{since ? ` since ${since.toLocaleDateString('en-IN')}` : ''} — {currentReason}
          </p>
          <button
            type="button"
            data-testid="clear-under-review"
            onClick={() => set(false)}
            disabled={busy}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-[11px] font-bold text-zinc-800 disabled:opacity-40"
          >
            Put back in the marketplace
          </button>
        </>
      ) : open ? (
        <div className="space-y-2">
          <textarea
            data-testid="under-review-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What is being looked into?"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs"
          />
          <div className="flex gap-2">
            <button
              type="button"
              data-testid="under-review-confirm"
              onClick={() => set(true)}
              disabled={reason.trim().length < 10 || busy}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40"
            >
              Place under review
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-[11px] font-bold text-zinc-700">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          data-testid="under-review-open"
          onClick={() => { setOpen(true); setReason(''); }}
          className="rounded-lg border border-amber-300 px-3 py-1.5 text-[11px] font-bold text-amber-700 hover:bg-amber-50"
        >
          Place under review
        </button>
      )}
    </div>
  );
}

export function StoreNotices({ shopId, notices }: { shopId: string; notices: (SellerNotice & { actorName: string | null })[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [kind, setKind] = React.useState<NoticeKind>(NoticeKind.WARNING);
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');
  const [requiresResponse, setRequiresResponse] = React.useState(false);
  const [respondByDays, setRespondByDays] = React.useState(7);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function send() {
    setBusy(true); setError(null);
    const res = await runAction(() =>
      sendNoticeAction({ shopId, kind, subject, body, requiresResponse, respondByDays: requiresResponse ? respondByDays : undefined })
    );
    if (!('success' in res)) { setError(res.error ?? 'Failed.'); setBusy(false); return; }
    setOpen(false); setSubject(''); setBody(''); setRequiresResponse(false); setBusy(false);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-zinc-200 p-4" data-testid="store-notices">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-zinc-950">
          Notices <span className="text-zinc-500">({notices.length})</span>
        </h2>
        <button
          type="button"
          data-testid="notice-compose-open"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-[11px] font-bold text-zinc-800"
        >
          {open ? 'Cancel' : 'Send a notice'}
        </button>
      </div>

      {open ? (
        <div className="mb-4 space-y-2 rounded-lg bg-zinc-50 p-3">
          <select
            data-testid="notice-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as NoticeKind)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs"
          >
            {Object.values(NoticeKind).map((k) => (
              <option key={k} value={k}>{KIND_LABELS[k]}</option>
            ))}
          </select>
          <input
            data-testid="notice-subject-input"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs"
          />
          <textarea
            data-testid="notice-body-input"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What the seller needs to know, and what they should do about it."
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs"
          />
          <label className="flex items-center gap-2 text-[11px] font-semibold text-zinc-700">
            <input
              type="checkbox"
              data-testid="notice-requires-response"
              checked={requiresResponse}
              onChange={(e) => setRequiresResponse(e.target.checked)}
            />
            Ask for a response
          </label>
          {requiresResponse ? (
            <label className="flex items-center gap-2 text-[11px] text-zinc-700">
              within
              <input
                type="number"
                data-testid="notice-respond-days"
                min={1}
                max={90}
                value={respondByDays}
                onChange={(e) => setRespondByDays(Number(e.target.value))}
                className="w-16 rounded border border-zinc-300 px-2 py-1 text-[11px]"
              />
              days
            </label>
          ) : null}
          {error ? (
            <p role="alert" data-testid="notice-send-error" className="text-[11px] font-semibold text-red-600">{error}</p>
          ) : null}
          <button
            type="button"
            data-testid="notice-send"
            onClick={send}
            disabled={busy || subject.trim().length < 5 || body.trim().length < 20}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40"
          >
            Send
          </button>
        </div>
      ) : null}

      {notices.length === 0 ? (
        <p data-testid="store-notice-empty" className="text-xs text-zinc-600">Nothing sent to this seller.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 text-xs" data-testid="store-notice-list">
          {notices.map((n) => (
            <li key={n.id} className="py-2" data-testid="store-notice-item">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-bold text-zinc-900">{n.subject}</span>
                <span className="text-[10px] text-zinc-400">{n.sentAt.toLocaleString('en-IN')}</span>
              </div>
              <div className="text-[11px] text-zinc-600">
                {KIND_LABELS[n.kind]}
                {n.actorName ? ` · by ${n.actorName}` : ''}
                {' · '}
                <span data-testid="notice-delivery">
                  {n.readAt ? `read ${n.readAt.toLocaleDateString('en-IN')}` : 'unread'}
                </span>
                {' · '}
                {n.emailedAt ? 'emailed' : 'not emailed'}
                {n.respondedAt ? ' · responded' : n.requiresResponse ? ' · awaiting response' : ''}
              </div>
              {n.response ? (
                <p className="mt-1 rounded bg-zinc-50 p-2 text-[11px] text-zinc-700" data-testid="store-notice-response">
                  {n.response}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
