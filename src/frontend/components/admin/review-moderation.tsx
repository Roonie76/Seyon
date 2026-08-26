'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { hideReviewAction, unhideReviewAction, type ModeratedReview } from '@/backend/actions/moderation';
import { runAction } from '@/frontend/lib/run-action';

/**
 * Reviews, with a way to deal with a bad one that is not deleting it.
 *
 * The comment stays visible to the admin after hiding, deliberately. The whole
 * argument for hiding over deleting is that somebody can later check whether
 * the hide was justified — which is impossible if the evidence goes with it.
 */
export function ReviewModeration({ reviews }: { reviews: ModeratedReview[] }) {
  const visible = reviews.filter((r) => !r.isHidden);
  const hidden = reviews.filter((r) => r.isHidden);

  return (
    <div className="rounded-xl border border-zinc-200 p-4">
      <h2 className="mb-1 text-sm font-bold text-zinc-950">
        Reviews <span className="text-zinc-500">({visible.length} shown, {hidden.length} hidden)</span>
      </h2>
      <p className="mb-3 text-[11px] text-zinc-600">
        Hiding removes a review from the storefront and from the rating. It is not deleted.
      </p>

      {reviews.length === 0 ? (
        <p data-testid="review-empty" className="text-xs text-zinc-600">No reviews.</p>
      ) : (
        <ul className="divide-y divide-zinc-100" data-testid="review-list">
          {reviews.map((r) => (
            <ReviewRow key={r.id} review={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewRow({ review }: { review: ModeratedReview }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function hide() {
    setBusy(true); setError(null);
    const res = await runAction(() => hideReviewAction(review.id, reason));
    if (!('success' in res)) { setError(res.error ?? 'Failed.'); setBusy(false); return; }
    setOpen(false); setReason(''); setBusy(false); router.refresh();
  }

  async function unhide() {
    setBusy(true); setError(null);
    const res = await runAction(() => unhideReviewAction(review.id));
    if (!('success' in res)) setError(res.error ?? 'Failed.');
    setBusy(false); router.refresh();
  }

  return (
    <li
      data-testid={review.isHidden ? 'review-row-hidden' : 'review-row'}
      className={`py-3 ${review.isHidden ? 'opacity-70' : ''}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-900" data-testid="review-rating">{review.rating} ★</span>
          <span className="text-[11px] text-zinc-600">{review.authorName ?? 'a buyer'}</span>
          {review.isHidden ? (
            <span data-testid="review-hidden-badge" className="rounded bg-zinc-200 px-1.5 py-0.5 text-[11px] font-bold text-zinc-700">
              hidden
            </span>
          ) : null}
        </div>
        <span className="text-[11px] text-zinc-400">{review.createdAt.toLocaleDateString('en-IN')}</span>
      </div>

      <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-800" data-testid="review-comment">{review.comment}</p>

      {review.isHidden ? (
        <p className="mt-1 rounded bg-zinc-50 p-2 text-[11px] text-zinc-700" data-testid="review-hidden-reason">
          Hidden{review.hiddenAt ? ` on ${review.hiddenAt.toLocaleDateString('en-IN')}` : ''}
          {review.hiddenByName ? ` by ${review.hiddenByName}` : ''} — {review.hiddenReason}
        </p>
      ) : null}

      {error ? (
        <p role="alert" data-testid="review-error" className="mt-1 text-[11px] font-semibold text-red-600">{error}</p>
      ) : null}

      <div className="mt-2">
        {review.isHidden ? (
          <button
            type="button"
            data-testid="unhide-review"
            onClick={unhide}
            disabled={busy}
            className="rounded border border-zinc-300 px-2 py-1 text-[11px] font-bold text-zinc-700 disabled:opacity-40"
          >
            Show again
          </button>
        ) : open ? (
          <div className="space-y-1">
            <input
              data-testid="hide-review-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this review being hidden?"
              className="w-full rounded border border-zinc-300 px-2 py-1 text-[11px]"
            />
            <div className="flex gap-1">
              <button
                type="button"
                data-testid="hide-review-confirm"
                onClick={hide}
                disabled={reason.trim().length < 10 || busy}
                className="rounded bg-red-600 px-2 py-1 text-[11px] font-bold text-white disabled:opacity-40"
              >
                Hide
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded border border-zinc-300 px-2 py-1 text-[11px] font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            data-testid="hide-review"
            onClick={() => { setOpen(true); setReason(''); }}
            className="text-[11px] font-bold text-red-600 hover:underline"
          >
            Hide
          </button>
        )}
      </div>
    </li>
  );
}
