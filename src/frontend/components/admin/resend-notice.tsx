'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { resendNoticeEmailAction } from '@/backend/actions/notices';
import { runAction } from '@/frontend/lib/run-action';

/**
 * Send the email for a notice again.
 *
 * Deliberately not "send the notice again". The notice exists and the seller
 * already has it in their inbox; this retries the convenience copy, for when
 * email was unconfigured or bouncing at the time. No new notice row is written,
 * because a duplicate in the seller's inbox would imply a second decision was
 * taken about them.
 */
export function ResendNoticeButton({
  noticeId,
  everEmailed,
}: {
  noticeId: string;
  everEmailed: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);

  async function resend() {
    setBusy(true); setError(null);
    const res = await runAction(() => resendNoticeEmailAction(noticeId));
    if (!('success' in res)) { setError(res.error ?? 'Failed.'); setBusy(false); return; }
    setSent(true); setBusy(false); router.refresh();
  }

  return (
    <div className="mt-2">
      {error ? (
        <p role="alert" data-testid="resend-error" className="mb-1 text-[11px] font-semibold text-red-600">{error}</p>
      ) : null}
      <button
        type="button"
        data-testid="resend-notice"
        onClick={resend}
        disabled={busy || sent}
        className="text-[11px] font-bold text-[#A77F3A] hover:underline disabled:opacity-40 disabled:no-underline"
      >
        {sent ? 'Email sent' : busy ? 'Sending…' : everEmailed ? 'Email it again' : 'Try emailing it'}
      </button>
    </div>
  );
}
