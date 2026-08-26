'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { verifyShopAction, suspendShopAction, deleteProductAction, deleteShopAsAdmin } from '@/actions/admin';
import { runAction } from '@/frontend/lib/run-action';

/**
 * The actions an admin can take against one store.
 *
 * Anything that costs the seller something asks for a reason first, and the
 * reason travels to the audit row. That is not ceremony: the seller is emailed
 * when they are suspended, and "your store was suspended" with nothing after it
 * is a support ticket rather than an explanation.
 */
export function StoreActions({
  shopId,
  slug,
  isVerified,
  isSuspended,
}: {
  shopId: string;
  slug: string;
  isVerified: boolean;
  isSuspended: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [prompt, setPrompt] = React.useState<null | 'suspend'>(null);
  const [reason, setReason] = React.useState('');

  async function toggleVerify() {
    setBusy(true); setError(null);
    const res = await runAction(() => verifyShopAction(shopId, !isVerified));
    if (!('success' in res)) setError(res.error ?? 'Failed.');
    setBusy(false); router.refresh();
  }

  async function doSuspend() {
    setBusy(true); setError(null);
    const res = await runAction(() => suspendShopAction(shopId, true, reason));
    if (!('success' in res)) { setError(res.error ?? 'Failed.'); setBusy(false); return; }
    setPrompt(null); setReason(''); setBusy(false); router.refresh();
  }

  async function unsuspend() {
    setBusy(true); setError(null);
    const res = await runAction(() => suspendShopAction(shopId, false));
    if (!('success' in res)) setError(res.error ?? 'Failed.');
    setBusy(false); router.refresh();
  }

  return (
    <div data-testid="store-actions" className="rounded-xl border border-zinc-200 p-4">
      <h2 className="mb-3 text-sm font-bold text-zinc-950">Actions</h2>
      {error ? (
        <p role="alert" data-testid="store-action-error" className="mb-2 text-xs font-semibold text-red-600">{error}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="toggle-verify"
          onClick={toggleVerify}
          disabled={busy}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-[11px] font-bold text-zinc-800 hover:bg-zinc-50 disabled:opacity-40"
        >
          {isVerified ? 'Remove verified badge' : 'Mark verified'}
        </button>

        {isSuspended ? (
          <button
            type="button"
            data-testid="unsuspend"
            onClick={unsuspend}
            disabled={busy}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            Reinstate store
          </button>
        ) : (
          <button
            type="button"
            data-testid="suspend-open"
            onClick={() => { setPrompt('suspend'); setReason(''); }}
            disabled={busy}
            className="rounded-lg border border-red-300 px-3 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-50 disabled:opacity-40"
          >
            Suspend store
          </button>
        )}

        <a
          href={`/store/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-[11px] font-bold text-zinc-800 hover:bg-zinc-50"
        >
          View storefront
        </a>
      </div>

      {prompt === 'suspend' ? (
        <div className="mt-3 space-y-2">
          <label htmlFor="suspend-reason" className="block text-[11px] font-bold text-zinc-700">
            Why? The seller is emailed this, so write something they can act on.
          </label>
          <textarea
            id="suspend-reason"
            data-testid="suspend-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs"
          />
          <div className="flex gap-2">
            <button
              type="button"
              data-testid="suspend-confirm"
              onClick={doSuspend}
              disabled={reason.trim().length < 10 || busy}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-red-700 disabled:opacity-40"
            >
              Suspend
            </button>
            <button
              type="button"
              onClick={() => setPrompt(null)}
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

export function DeleteProductButton({ productId, title }: { productId: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onDelete() {
    setBusy(true); setError(null);
    const res = await runAction(() => deleteProductAction(productId, reason));
    if (!('success' in res)) { setError(res.error ?? 'Failed.'); setBusy(false); return; }
    setOpen(false); setBusy(false); router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        data-testid="delete-product"
        onClick={() => { setOpen(true); setReason(''); }}
        className="text-[11px] font-bold text-red-600 hover:underline"
      >
        Delete
      </button>
    );
  }

  return (
    <div className="space-y-1">
      <input
        data-testid="delete-product-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={`Why delete "${title}"?`}
        className="w-full rounded border border-zinc-300 px-2 py-1 text-[11px]"
      />
      {error ? <p className="text-[11px] font-semibold text-red-600">{error}</p> : null}
      <div className="flex gap-1">
        <button
          type="button"
          data-testid="delete-product-confirm"
          onClick={onDelete}
          disabled={reason.trim().length < 10 || busy}
          className="rounded bg-red-600 px-2 py-1 text-[11px] font-bold text-white disabled:opacity-40"
        >
          Confirm
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded border border-zinc-300 px-2 py-1 text-[11px] font-bold">
          Cancel
        </button>
      </div>
    </div>
  );
}

/**
 * Removing a store, permanently.
 *
 * Two gates rather than one. A reason, because the audit row and the seller's
 * email both carry it; and the store's address typed out, because "Suspend" and
 * "Delete" sit on the same page and only one of them can be undone.
 */
export function DeleteStoreButton({
  shopId,
  slug,
  name,
  productCount,
}: {
  shopId: string;
  slug: string;
  name: string;
  productCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [confirmSlug, setConfirmSlug] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const ready = reason.trim().length >= 10 && confirmSlug.trim().toLowerCase() === slug;

  async function onDelete() {
    setBusy(true); setError(null);
    const res = await runAction(() => deleteShopAsAdmin({ shopId, reason, confirmSlug }));
    if (!('success' in res)) { setError(res.error ?? 'Failed.'); setBusy(false); return; }
    // The store no longer exists, so staying on its page would 404.
    router.push('/admin/stores');
    router.refresh();
  }

  return (
    <div className="mt-4 rounded-xl border border-red-200 bg-red-50/40 p-4" data-testid="delete-store">
      <h3 className="text-sm font-bold text-red-900">Remove this store</h3>
      <p className="mt-1 text-[11px] text-red-800">
        Permanent. Deletes {name} and its {productCount} listing{productCount === 1 ? '' : 's'},
        along with every review, complaint and notice attached to it. Only the audit record
        survives. Suspend instead if there is any chance of reinstating it.
      </p>

      {error ? (
        <p role="alert" data-testid="delete-store-error" className="mt-2 text-[11px] font-semibold text-red-700">
          {error}
        </p>
      ) : null}

      {!open ? (
        <button
          type="button"
          data-testid="delete-store-open"
          onClick={() => { setOpen(true); setReason(''); setConfirmSlug(''); }}
          className="mt-3 rounded-lg border border-red-400 px-3 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-100"
        >
          Remove store
        </button>
      ) : (
        <div className="mt-3 space-y-2">
          <label htmlFor="delete-store-reason" className="block text-[11px] font-bold text-red-900">
            Why? The owner is emailed this, and it is kept in the audit record after the store is gone.
          </label>
          <textarea
            id="delete-store-reason"
            data-testid="delete-store-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border border-red-300 px-3 py-2 text-xs"
          />

          <label htmlFor="delete-store-slug" className="block text-[11px] font-bold text-red-900">
            Type <code className="rounded bg-white px-1 font-mono">{slug}</code> to confirm.
          </label>
          <input
            id="delete-store-slug"
            data-testid="delete-store-slug"
            value={confirmSlug}
            onChange={(e) => setConfirmSlug(e.target.value)}
            autoComplete="off"
            className="w-full rounded-lg border border-red-300 px-3 py-2 text-xs"
          />

          <div className="flex gap-2">
            <button
              type="button"
              data-testid="delete-store-confirm"
              onClick={onDelete}
              disabled={!ready || busy}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-red-700 disabled:opacity-40"
            >
              {busy ? 'Removing…' : 'Remove permanently'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-[11px] font-bold text-red-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
