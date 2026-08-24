'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { acknowledgeComplaintAction, closeComplaintAction } from '@/backend/actions/complaints';
import { runAction } from '@/frontend/lib/run-action';

/**
 * The two steps a complaint goes through, kept visibly separate.
 *
 * Acknowledging is one click with no text, because the forty-eight hour clock
 * should never be missed for want of someone having time to write a paragraph.
 * Closing needs a note, because that note is what the person who complained
 * receives — and "resolved" with nothing after it is what makes people stop
 * reporting things.
 */
export function ComplaintActions({
  reportId,
  acknowledged,
  closed,
}: {
  reportId: string;
  acknowledged: boolean;
  closed: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<null | 'RESOLVED' | 'REJECTED'>(null);
  const [note, setNote] = React.useState('');

  if (closed) return null;

  async function acknowledge() {
    setBusy(true); setError(null);
    const res = await runAction(() => acknowledgeComplaintAction(reportId));
    if (!('success' in res)) setError(res.error ?? 'Failed.');
    setBusy(false); router.refresh();
  }

  async function close() {
    if (!mode) return;
    setBusy(true); setError(null);
    const res = await runAction(() => closeComplaintAction(reportId, mode, note));
    if (!('success' in res)) { setError(res.error ?? 'Failed.'); setBusy(false); return; }
    setMode(null); setNote(''); setBusy(false); router.refresh();
  }

  return (
    <div className="mt-3 border-t border-zinc-100 pt-3" data-testid="complaint-actions">
      {error ? (
        <p role="alert" data-testid="complaint-error" className="mb-2 text-[11px] font-semibold text-red-600">{error}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!acknowledged ? (
          <button
            type="button"
            data-testid="acknowledge"
            onClick={acknowledge}
            disabled={busy}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-zinc-800 disabled:opacity-40"
          >
            Acknowledge
          </button>
        ) : null}

        <button
          type="button"
          data-testid="close-upheld"
          onClick={() => { setMode('RESOLVED'); setNote(''); }}
          disabled={busy}
          className="rounded-lg border border-emerald-300 px-3 py-1.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
        >
          Close — action taken
        </button>

        <button
          type="button"
          data-testid="close-rejected"
          onClick={() => { setMode('REJECTED'); setNote(''); }}
          disabled={busy}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-[11px] font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
        >
          Close — nothing wrong
        </button>
      </div>

      {mode ? (
        <div className="mt-3 space-y-2">
          <label htmlFor={`note-${reportId}`} className="block text-[11px] font-bold text-zinc-700">
            {mode === 'RESOLVED'
              ? 'What was done? The person who reported it is sent this.'
              : 'Why was nothing done? The person who reported it is sent this.'}
          </label>
          <textarea
            id={`note-${reportId}`}
            data-testid="complaint-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs"
          />
          <div className="flex gap-2">
            <button
              type="button"
              data-testid="complaint-close-confirm"
              onClick={close}
              disabled={note.trim().length < 10 || busy}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setMode(null)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-[11px] font-bold text-zinc-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
