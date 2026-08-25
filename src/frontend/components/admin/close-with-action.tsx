'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { NoticeKind } from '@prisma/client';
import { closeComplaintWithActionAction } from '@/backend/actions/complaints';
import { runAction } from '@/frontend/lib/run-action';

/**
 * Closing a complaint and doing something about it, in one gesture.
 *
 * Every action offered here already existed on its own screen. What did not
 * exist was doing them together: deciding a review was abusive meant closing
 * the complaint here, navigating to the store, hiding the review there, and
 * hoping nothing interrupted you in between. Steps that require leaving the
 * page are the steps that get skipped at two in the morning.
 *
 * The two decisions stay visibly separate. What happened to the store is not
 * the same statement as what the person who complained is told, and the form
 * asks for both rather than reusing one for the other.
 */

type Escalation = 'NONE' | 'SUSPEND_SHOP' | 'HIDE_REVIEW' | 'SEND_NOTICE';

export function CloseWithAction({
  reportId,
  hasReview,
  reviewAlreadyHidden,
  shopAlreadySuspended,
}: {
  reportId: string;
  hasReview: boolean;
  reviewAlreadyHidden: boolean;
  shopAlreadySuspended: boolean;
}) {
  const router = useRouter();
  const [outcome, setOutcome] = React.useState<null | 'RESOLVED' | 'REJECTED'>(null);
  const [note, setNote] = React.useState('');
  const [escalation, setEscalation] = React.useState<Escalation>('NONE');
  const [reason, setReason] = React.useState('');
  const [kind, setKind] = React.useState<NoticeKind>(NoticeKind.WARNING);
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');
  const [requiresResponse, setRequiresResponse] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const canHide = hasReview && !reviewAlreadyHidden;
  const canSuspend = !shopAlreadySuspended;

  const escalationReady =
    escalation === 'NONE' ||
    ((escalation === 'SUSPEND_SHOP' || escalation === 'HIDE_REVIEW') && reason.trim().length >= 10) ||
    (escalation === 'SEND_NOTICE' && subject.trim().length >= 5 && body.trim().length >= 20);

  const ready = Boolean(outcome) && note.trim().length >= 10 && escalationReady;

  async function submit() {
    if (!outcome) return;
    setBusy(true); setError(null);

    const payload =
      escalation === 'NONE'
        ? { type: 'NONE' as const }
        : escalation === 'SEND_NOTICE'
          ? { type: 'SEND_NOTICE' as const, kind, subject, body, requiresResponse, respondByDays: requiresResponse ? 14 : undefined }
          : { type: escalation, reason };

    const res = await runAction(() =>
      closeComplaintWithActionAction({ reportId, outcome, note, escalation: payload })
    );
    if (!('success' in res)) { setError(res.error ?? 'Failed.'); setBusy(false); return; }
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-zinc-200 p-4" data-testid="close-with-action">
      <h2 className="mb-1 text-sm font-bold text-zinc-950">Close it</h2>
      <p className="mb-3 text-[11px] text-zinc-600">
        Anything chosen here happens in the same step as the closure — all of it, or none of it.
      </p>

      {error ? (
        <p role="alert" data-testid="close-action-error" className="mb-2 text-[11px] font-semibold text-red-600">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="outcome-resolved"
          onClick={() => setOutcome('RESOLVED')}
          className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold ${
            outcome === 'RESOLVED'
              ? 'border-emerald-600 bg-emerald-600 text-white'
              : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
          }`}
        >
          Action taken
        </button>
        <button
          type="button"
          data-testid="outcome-rejected"
          onClick={() => { setOutcome('REJECTED'); setEscalation('NONE'); }}
          className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold ${
            outcome === 'REJECTED'
              ? 'border-zinc-900 bg-zinc-900 text-white'
              : 'border-zinc-300 text-zinc-700 hover:bg-zinc-50'
          }`}
        >
          Nothing wrong
        </button>
      </div>

      {outcome ? (
        <div className="mt-3 space-y-3">
          <div className="space-y-1">
            <label htmlFor="close-note" className="block text-[11px] font-bold text-zinc-700">
              {outcome === 'RESOLVED'
                ? 'What was done? The person who reported it is sent this.'
                : 'Why was nothing done? The person who reported it is sent this.'}
            </label>
            <textarea
              id="close-note"
              data-testid="close-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs"
            />
          </div>

          {outcome === 'RESOLVED' ? (
            <div className="space-y-2 rounded-lg bg-zinc-50 p-3">
              <label htmlFor="escalation" className="block text-[11px] font-bold text-zinc-700">
                And do what?
              </label>
              <select
                id="escalation"
                data-testid="escalation-select"
                value={escalation}
                onChange={(e) => { setEscalation(e.target.value as Escalation); setReason(''); }}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs"
              >
                <option value="NONE">Nothing further — I have already acted</option>
                {canHide ? <option value="HIDE_REVIEW">Hide the review</option> : null}
                {canSuspend ? <option value="SUSPEND_SHOP">Suspend the store</option> : null}
                <option value="SEND_NOTICE">Send the seller a notice</option>
              </select>

              {escalation === 'HIDE_REVIEW' || escalation === 'SUSPEND_SHOP' ? (
                <div className="space-y-1">
                  <label htmlFor="escalation-reason" className="block text-[11px] font-bold text-zinc-700">
                    {escalation === 'HIDE_REVIEW'
                      ? 'Why is the review being hidden? Your finding, not the complaint.'
                      : 'Why is the store being suspended? The seller is sent this.'}
                  </label>
                  <textarea
                    id="escalation-reason"
                    data-testid="escalation-reason"
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs"
                  />
                </div>
              ) : null}

              {escalation === 'SEND_NOTICE' ? (
                <div className="space-y-2">
                  <select
                    aria-label="Notice kind"
                    data-testid="notice-kind"
                    value={kind}
                    onChange={(e) => setKind(e.target.value as NoticeKind)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs"
                  >
                    {Object.values(NoticeKind).map((k) => (
                      <option key={k} value={k}>{k.replace(/_/g, ' ').toLowerCase()}</option>
                    ))}
                  </select>
                  <input
                    aria-label="Notice subject"
                    data-testid="notice-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Subject"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs"
                  />
                  <textarea
                    aria-label="Notice body"
                    data-testid="notice-body"
                    rows={3}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="What does the seller need to know or do?"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs"
                  />
                  <label className="flex items-center gap-2 text-[11px] font-semibold text-zinc-700">
                    <input
                      type="checkbox"
                      data-testid="notice-requires-response"
                      checked={requiresResponse}
                      onChange={(e) => setRequiresResponse(e.target.checked)}
                    />
                    Ask for a response within 14 days
                  </label>
                </div>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            data-testid="close-with-action-confirm"
            onClick={submit}
            disabled={!ready || busy}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-[11px] font-bold text-white disabled:opacity-40"
          >
            {busy ? 'Closing…' : escalation === 'NONE' ? 'Close complaint' : 'Close and act'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
