'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { repairStoreAction } from '@/actions/admin-stores';
import { runAction } from '@/frontend/lib/run-action';

/**
 * Correcting a store's address or number.
 *
 * The warning is not decoration. Changing a slug is the only admin action here
 * whose damage happens somewhere the admin cannot see — in links a seller
 * shared months ago — so the screen says what happens to them before the
 * change, not after.
 */
export function StoreRepair({
  shopId,
  slug,
  whatsapp,
}: {
  shopId: string;
  slug: string;
  whatsapp: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [nextSlug, setNextSlug] = React.useState(slug);
  const [nextWhatsapp, setNextWhatsapp] = React.useState(whatsapp);
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const slugChanged = nextSlug.trim().toLowerCase() !== slug;
  const numberChanged = nextWhatsapp.trim() !== whatsapp;
  const ready = (slugChanged || numberChanged) && reason.trim().length >= 10;

  async function save() {
    setBusy(true); setError(null);
    const res = await runAction(() =>
      repairStoreAction({
        shopId,
        ...(slugChanged ? { slug: nextSlug.trim().toLowerCase() } : {}),
        ...(numberChanged ? { whatsapp: nextWhatsapp.trim() } : {}),
        reason,
      })
    );
    if (!('success' in res)) { setError(res.error ?? 'Failed.'); setBusy(false); return; }
    setBusy(false); setOpen(false);
    if (slugChanged) router.push(`/admin/stores/${nextSlug.trim().toLowerCase()}`);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        data-testid="repair-open"
        onClick={() => { setOpen(true); setNextSlug(slug); setNextWhatsapp(whatsapp); setReason(''); }}
        className="mt-3 rounded-lg border border-zinc-300 px-3 py-1.5 text-[11px] font-bold text-zinc-800 hover:bg-zinc-50"
      >
        Fix address or number
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-zinc-300 p-3" data-testid="repair-form">
      {error ? (
        <p role="alert" data-testid="repair-error" className="text-[11px] font-semibold text-red-600">{error}</p>
      ) : null}

      <label htmlFor="repair-slug" className="block text-[11px] font-bold text-zinc-700">Address</label>
      <input
        id="repair-slug"
        data-testid="repair-slug"
        value={nextSlug}
        onChange={(e) => setNextSlug(e.target.value)}
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs"
      />

      {slugChanged ? (
        <p data-testid="repair-slug-warning" className="rounded bg-amber-50 p-2 text-[11px] text-amber-900">
          Every link the seller has already shared points at <code>/store/{slug}</code>. That address
          is kept and can never be given to another store — but it does <strong>not</strong> currently
          redirect here, because of a known routing fault on storefront pages (F-15). Until that is
          fixed, changing this address breaks every link the seller has posted. Tell them first.
        </p>
      ) : null}

      <label htmlFor="repair-whatsapp" className="block text-[11px] font-bold text-zinc-700">WhatsApp number</label>
      <input
        id="repair-whatsapp"
        data-testid="repair-whatsapp"
        value={nextWhatsapp}
        onChange={(e) => setNextWhatsapp(e.target.value)}
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs"
      />

      <label htmlFor="repair-reason" className="block text-[11px] font-bold text-zinc-700">
        What was wrong with it?
      </label>
      <textarea
        id="repair-reason"
        data-testid="repair-reason"
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs"
      />

      <div className="flex gap-2">
        <button
          type="button"
          data-testid="repair-save"
          onClick={save}
          disabled={!ready || busy}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-[11px] font-bold text-zinc-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
