'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { exportMyData, deleteMyAccount } from '@/backend/actions/account';
import { runAction } from '@/frontend/lib/run-action';

/**
 * The two rights the DPDP Act 2023 gives a data principal: to get a copy of
 * what is held about them (s.11), and to have it erased (s.12).
 *
 * Both were previously unreachable — the privacy policy said "you can request
 * deletion of your account at any time", but there was no control anywhere in
 * the product and no inbox monitored for it. A policy promise with no
 * mechanism behind it is the worst of both worlds.
 *
 * Deletion is gated on typing the account email rather than a checkbox,
 * because it cascades a seller's entire storefront and cannot be undone.
 */
export function AccountDataControls({ email }: { email: string | null }) {
  const router = useRouter();

  const [exporting, setExporting] = React.useState(false);
  const [exportError, setExportError] = React.useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmation, setConfirmation] = React.useState('');
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setExportError(null);

    const res = await runAction(() => exportMyData());

    if (!('data' in res)) {
      setExportError(res.error ?? 'Something went wrong.');
      setExporting(false);
      return;
    }

    // Built in the browser from the returned object rather than served from a
    // route, so the file never sits at a guessable URL.
    const blob = new Blob([JSON.stringify(res.data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seyon-my-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    setExporting(false);
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);

    const res = await runAction(() => deleteMyAccount(confirmation));

    if (!('success' in res)) {
      setDeleteError(res.error ?? 'Something went wrong.');
      setDeleting(false);
      return;
    }

    // The session cookie is already cleared server-side; refresh so no stale
    // signed-in shell is left rendered.
    router.replace('/');
    router.refresh();
  }

  const canDelete =
    Boolean(email) && confirmation.trim().toLowerCase() === (email ?? '').trim().toLowerCase();

  return (
    <div className="mx-auto mt-10 max-w-3xl space-y-6">
      <section className="rounded-xl border border-zinc-200 p-5">
        <h2 className="text-sm font-bold text-zinc-950">Download your data</h2>
        <p className="mt-1 text-xs text-zinc-600">
          A JSON file with your account details, your store and products, the reviews and
          reports you wrote, and your wishlist. It does not include other people&apos;s
          personal information.
        </p>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="mt-3 rounded-lg border border-zinc-300 px-4 py-2 text-xs font-bold text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
        >
          {exporting ? 'Preparing…' : 'Download my data'}
        </button>
        {exportError ? (
          <p role="alert" className="mt-2 text-xs font-semibold text-red-600">
            {exportError}
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-red-200 bg-red-50/40 p-5">
        <h2 className="text-sm font-bold text-red-900">Delete your account</h2>
        <p className="mt-1 text-xs text-red-800/80">
          This permanently removes your account, your storefront, every product and image on
          it, your reviews and your wishlist. It cannot be undone.
        </p>

        {!confirmOpen ? (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="mt-3 rounded-lg border border-red-300 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
          >
            Delete my account
          </button>
        ) : (
          <div className="mt-3 space-y-2">
            <label htmlFor="delete-confirm" className="block text-xs font-semibold text-red-900">
              Type <span className="font-mono">{email ?? 'your email'}</span> to confirm.
            </label>
            <input
              id="delete-confirm"
              type="text"
              autoComplete="off"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className="w-full rounded-lg border border-red-300 px-3 py-2 text-xs"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={!canDelete || deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-40"
              >
                {deleting ? 'Deleting…' : 'Permanently delete'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmation('');
                  setDeleteError(null);
                }}
                disabled={deleting}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-bold text-zinc-700 hover:bg-white"
              >
                Cancel
              </button>
            </div>
            {deleteError ? (
              <p role="alert" className="text-xs font-semibold text-red-700">
                {deleteError}
              </p>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
