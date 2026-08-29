'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { NoticeKind } from '@prisma/client';
import { markNoticeReadAction, respondToNoticeAction, type SellerNotice } from '@/backend/actions/notices';
import { runAction } from '@/frontend/lib/run-action';

/**
 * The seller's side of a notice.
 *
 * Two things matter here and neither is cosmetic. A notice is marked read when
 * the seller opens it, so "they were never told" becomes a checkable claim
 * rather than an argument. And a notice that asks for something can be answered
 * in place, because the alternative — "reply to this email" — routes a
 * compliance conversation into somebody's personal inbox where it is lost.
 */

const KIND_STYLES: Record<NoticeKind, string> = {
  WARNING: 'bg-amber-100 text-amber-900',
  POLICY_VIOLATION: 'bg-red-100 text-red-800',
  INFORMATION_REQUEST: 'bg-blue-100 text-blue-800',
  SUSPENSION: 'bg-red-100 text-red-800',
  REINSTATEMENT: 'bg-emerald-100 text-emerald-800',
};

const KIND_LABELS: Record<NoticeKind, string> = {
  WARNING: 'Warning',
  POLICY_VIOLATION: 'Policy violation',
  INFORMATION_REQUEST: 'Information requested',
  SUSPENSION: 'Suspension',
  REINSTATEMENT: 'Reinstated',
};

export function NoticeInbox({ notices }: { notices: SellerNotice[] }) {
  if (notices.length === 0) {
    return (
      <p data-testid="notice-empty" className="rounded-xl border border-zinc-200 p-6 text-center text-xs text-zinc-600">
        Nothing from the Seyon team. That is the good outcome.
      </p>
    );
  }

  return (
    <ul className="space-y-3" data-testid="notice-list">
      {notices.map((n) => (
        <NoticeCard key={n.id} notice={n} />
      ))}
    </ul>
  );
}

function NoticeCard({ notice }: { notice: SellerNotice }) {
  const router = useRouter();
  /**
   * Collapsed, always.
   *
   * This was `React.useState(!notice.readAt)`, which meant every unread notice
   * mounted already expanded — so the effect below saw `open === true` on the
   * very first render and marked it read. Loading /notices marked the whole
   * inbox read at a glance, fired one server action and one `router.refresh()`
   * per unread notice, and destroyed the only record of what the seller had
   * actually looked at. The comment underneath claimed the opposite was
   * happening. The unread state is evidence in a dispute; it is not the page's
   * to spend on the seller's behalf.
   */
  const [open, setOpen] = React.useState(false);
  const [response, setResponse] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const markedRef = React.useRef(false);

  // Mark read the first time the seller expands it, and only once. `open`
  // starts false, so this cannot fire on mount.
  React.useEffect(() => {
    if (!open || notice.readAt || markedRef.current) return;
    markedRef.current = true;
    runAction(() => markNoticeReadAction(notice.id)).then(() => router.refresh());
  }, [open, notice.id, notice.readAt, router]);

  async function respond() {
    setBusy(true); setError(null);
    const res = await runAction(() => respondToNoticeAction(notice.id, response));
    if (!('success' in res)) { setError(res.error ?? 'Failed.'); setBusy(false); return; }
    setResponse(''); setBusy(false); router.refresh();
  }

  const overdue =
    notice.requiresResponse && !notice.respondedAt && notice.respondBy && notice.respondBy < new Date();

  return (
    <li
      data-testid="notice-item"
      className={`rounded-xl border p-4 ${notice.readAt ? 'border-zinc-200' : 'border-zinc-900 bg-zinc-50'}`}
    >
      <button
        type="button"
        data-testid="notice-toggle"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${KIND_STYLES[notice.kind]}`} data-testid="notice-kind">
              {KIND_LABELS[notice.kind]}
            </span>
            {!notice.readAt ? (
              <span data-testid="notice-unread" className="rounded bg-zinc-900 px-1.5 py-0.5 text-[11px] font-bold text-white">new</span>
            ) : null}
            {overdue ? (
              <span data-testid="notice-overdue" className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-bold text-red-800">
                response overdue
              </span>
            ) : null}
          </div>
          <h3 className="mt-1 text-sm font-bold text-zinc-950" data-testid="notice-subject">{notice.subject}</h3>
        </div>
        <span className="shrink-0 text-[11px] text-zinc-500">{notice.sentAt.toLocaleDateString('en-IN')}</span>
      </button>

      {open ? (
        <div className="mt-3 space-y-3">
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-zinc-800" data-testid="notice-body">
            {notice.body}
          </p>

          {notice.requiresResponse && notice.respondBy ? (
            <p className="text-[11px] font-semibold text-zinc-600">
              A response is asked for by {notice.respondBy.toLocaleDateString('en-IN')}.
            </p>
          ) : null}

          {notice.respondedAt ? (
            <div className="rounded-lg bg-zinc-100 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                Your response · {notice.respondedAt.toLocaleDateString('en-IN')}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-800" data-testid="notice-response">{notice.response}</p>
            </div>
          ) : notice.requiresResponse ? (
            <div className="space-y-2">
              <label htmlFor={`resp-${notice.id}`} className="block text-[11px] font-bold text-zinc-700">
                Your response
              </label>
              <textarea
                id={`resp-${notice.id}`}
                data-testid="notice-response-input"
                rows={3}
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs"
              />
              {error ? (
                <p role="alert" data-testid="notice-error" className="text-[11px] font-semibold text-red-600">{error}</p>
              ) : null}
              <button
                type="button"
                data-testid="notice-respond"
                onClick={respond}
                disabled={response.trim().length < 10 || busy}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40"
              >
                Send response
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
