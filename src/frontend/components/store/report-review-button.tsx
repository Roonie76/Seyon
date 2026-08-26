'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ReportCategory } from '@prisma/client';
import { createReport } from '@/backend/actions/reports';
import { runAction } from '@/frontend/lib/run-action';
import { REPORT_CATEGORY_LABELS } from '@/shared/lib/complaints';

/**
 * Reporting a review.
 *
 * Until now `Report` could only be about a shop, so the only way to deal with a
 * defamatory or fake review was for an admin to happen to read it. That made
 * review-bombing invisible: twenty one-star reviews in an hour and a genuinely
 * bad week produced exactly the same thing in the moderation queue, which was
 * nothing.
 *
 * The categories offered here are the subset that can sensibly describe a
 * review. "Counterfeit goods" is about a listing; "offensive content" and
 * "impersonation" are about what someone wrote.
 */

const REVIEW_CATEGORIES: ReportCategory[] = [
  ReportCategory.OFFENSIVE_CONTENT,
  ReportCategory.MISLEADING_LISTING,
  ReportCategory.IMPERSONATION,
  ReportCategory.FRAUD_OR_SCAM,
  ReportCategory.OTHER,
];

export function ReportReviewButton({
  shopId,
  reviewId,
  authorName,
}: {
  shopId: string;
  reviewId: string;
  authorName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [category, setCategory] = React.useState<ReportCategory>(ReportCategory.OFFENSIVE_CONTENT);
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  async function submit() {
    setBusy(true); setError(null);
    const res = await runAction(() => createReport(shopId, { category, reason, reviewId }));
    if (!('success' in res)) { setError(res.error ?? 'Could not send that.'); setBusy(false); return; }
    setDone(true); setBusy(false); setOpen(false);
    router.refresh();
  }

  if (done) {
    return (
      <p data-testid="report-review-done" className="mt-2 text-[11px] font-semibold text-emerald-700">
        Reported. A moderator will look at it.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        data-testid="report-review-open"
        onClick={() => { setOpen(true); setReason(''); setError(null); }}
        className="mt-2 text-[11px] font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        Report this review
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-zinc-200 bg-white p-2" data-testid="report-review-form">
      <p className="text-[11px] font-bold text-foreground">
        Report {authorName}&apos;s review
      </p>

      {error ? (
        <p role="alert" data-testid="report-review-error" className="text-[11px] font-semibold text-red-600">
          {error}
        </p>
      ) : null}

      <select
        aria-label="What is wrong with this review?"
        data-testid="report-review-category"
        value={category}
        onChange={(e) => setCategory(e.target.value as ReportCategory)}
        className="w-full rounded border border-zinc-300 px-2 py-1 text-[11px]"
      >
        {REVIEW_CATEGORIES.map((c) => (
          <option key={c} value={c}>{REPORT_CATEGORY_LABELS[c]}</option>
        ))}
      </select>

      <textarea
        aria-label="What is wrong with this review?"
        data-testid="report-review-reason"
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="What is wrong with it?"
        className="w-full rounded border border-zinc-300 px-2 py-1 text-[11px]"
      />

      <div className="flex gap-1">
        <button
          type="button"
          data-testid="report-review-submit"
          onClick={submit}
          disabled={reason.trim().length < 5 || busy}
          className="rounded bg-zinc-900 px-2 py-1 text-[11px] font-bold text-white disabled:opacity-40"
        >
          {busy ? 'Sending…' : 'Send'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-zinc-300 px-2 py-1 text-[11px] font-bold text-zinc-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
