'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { hideReviewAction } from '@/backend/actions/moderation';
import { runAction } from '@/frontend/lib/run-action';
import type { ComplaintReviewTarget } from '@/backend/actions/complaints';

/**
 * The review a complaint is about, with the one action worth taking on it.
 *
 * Hiding is offered here rather than only on the store's moderation screen
 * because this is where a moderator has the context to judge it: the complaint
 * text, who wrote the review, and what else has been said about the store. A
 * step that requires navigating somewhere else is a step that gets skipped.
 *
 * The reason is prefilled from the complaint but stays editable — the
 * complainant's words are an allegation, and what goes in the audit row should
 * be the moderator's finding.
 */
export function ComplaintReviewTargetCard({
  review,
  suggestedReason,
}: {
  review: ComplaintReviewTarget;
  suggestedReason: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState(suggestedReason);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function hide() {
    setBusy(true); setError(null);
    const res = await runAction(() => hideReviewAction(review.id, reason));
    if (!('success' in res)) { setError(res.error ?? 'Failed.'); setBusy(false); return; }
    setOpen(false); setBusy(false); router.refresh();
  }

  return (
    <div className="rounded-xl border border-zinc-200 p-4" data-testid="complaint-review-target">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-zinc-950">The review complained about</h2>
        {review.isHidden ? (
          <span data-testid="complaint-review-hidden" className="rounded bg-zinc-200 px-1.5 py-0.5 text-[11px] font-bold text-zinc-700">
            hidden
          </span>
        ) : (
          <span data-testid="complaint-review-visible" className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold text-emerald-800">
            visible to buyers
          </span>
        )}
      </div>

      <div className="rounded-lg bg-zinc-50 p-3 text-xs">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-semibold text-zinc-900" data-testid="complaint-review-author">
            {review.authorName ?? 'Anonymous'}
          </span>
          <span className="text-[11px] text-zinc-500">
            {review.rating}/5 · {review.createdAt.toLocaleDateString('en-IN')}
          </span>
        </div>
        <p className="mt-1 whitespace-pre-wrap text-zinc-800" data-testid="complaint-review-comment">
          {review.comment}
        </p>
      </div>

      {error ? (
        <p role="alert" data-testid="complaint-review-error" className="mt-2 text-[11px] font-semibold text-red-600">
          {error}
        </p>
      ) : null}

      {review.isHidden ? (
        <p className="mt-2 text-[11px] text-zinc-600">
          Already hidden. It no longer counts towards the store&apos;s rating and is not shown to
          buyers, and it is still on record if the reviewer disputes the decision.
        </p>
      ) : !open ? (
        <button
          type="button"
          data-testid="complaint-hide-review-open"
          onClick={() => { setOpen(true); setReason(suggestedReason); }}
          className="mt-3 rounded-lg border border-red-300 px-3 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-50"
        >
          Hide this review
        </button>
      ) : (
        <div className="mt-3 space-y-2">
          <label htmlFor="complaint-hide-reason" className="block text-[11px] font-bold text-zinc-700">
            Why is it being hidden? This is your finding, not the complaint — it goes in the record.
          </label>
          <textarea
            id="complaint-hide-reason"
            data-testid="complaint-hide-review-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs"
          />
          <div className="flex gap-2">
            <button
              type="button"
              data-testid="complaint-hide-review-confirm"
              onClick={hide}
              disabled={reason.trim().length < 10 || busy}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40"
            >
              {busy ? 'Hiding…' : 'Hide review'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-[11px] font-bold text-zinc-700"
            >
              Cancel
            </button>
          </div>
          <p className="text-[11px] text-zinc-500">
            Hiding does not close the complaint. Close it separately, so the person who reported it
            is told what was decided.
          </p>
        </div>
      )}
    </div>
  );
}
