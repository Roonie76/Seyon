'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { submitTier0, submitTier1, uploadIdentityDocument, type KycView } from '@/backend/actions/kyc';
import { runAction } from '@/frontend/lib/run-action';
import { SELLER_UNDERTAKING } from '@/shared/data/seller-undertaking';
import { checkPan, checkGstin } from '@/shared/lib/kyc';

/**
 * Seller identity, in the dashboard.
 *
 * Two steps, shown as two steps, because they are not the same commitment.
 * Tier 0 takes two minutes and lists the store; Tier 1 asks for a document and
 * earns a badge. Presenting them as one long form would make the cheap step
 * look as expensive as the costly one.
 *
 * The PAN and GSTIN checks run here as well as on the server so a typo is
 * caught while the seller is still looking at the field, rather than after a
 * round trip. The server repeats them — the browser's opinion is convenience,
 * never authority.
 */

const FIELD =
  'w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#A77F3A]/40';
const LABEL = 'block text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1';

export function KycPanel({ initial }: { initial: KycView }) {
  const router = useRouter();
  const [kyc] = React.useState(initial);

  return (
    <div className="mx-auto max-w-3xl space-y-6" data-testid="kyc-panel">
      <Tier0Section kyc={kyc} onDone={() => router.refresh()} />
      {kyc.tier0Complete ? <Tier1Section kyc={kyc} onDone={() => router.refresh()} /> : null}
    </div>
  );
}

function StatusPill({ listed }: { listed: boolean }) {
  return (
    <span
      data-testid="listing-status"
      className={
        listed
          ? 'rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700'
          : 'rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-bold text-amber-800'
      }
    >
      {listed ? 'Listed in marketplace' : 'Not yet listed'}
    </span>
  );
}

function Tier0Section({ kyc, onDone }: { kyc: KycView; onDone: () => void }) {
  const [accepted, setAccepted] = React.useState(Boolean(kyc.undertakingAt));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await runAction(() =>
      submitTier0({
        legalName: String(fd.get('legalName') ?? ''),
        addressLine1: String(fd.get('addressLine1') ?? ''),
        addressLine2: String(fd.get('addressLine2') ?? ''),
        city: String(fd.get('city') ?? ''),
        state: String(fd.get('state') ?? ''),
        postalCode: String(fd.get('postalCode') ?? ''),
        acceptedUndertaking: accepted,
      })
    );
    if (!('success' in res)) {
      setError(res.error ?? 'Something went wrong.');
      setBusy(false);
      return;
    }
    setDone(true);
    setBusy(false);
    onDone();
  }

  return (
    <section className="rounded-xl border border-zinc-200 p-5">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="text-sm font-bold text-zinc-950">Step 1 — Business details</h2>
        <StatusPill listed={kyc.isListed} />
      </div>
      <p className="mb-4 text-xs text-zinc-600">
        Required before your store appears in the marketplace and search. Your legal name and
        address are shown to buyers, because the law requires a marketplace to say who they are
        buying from. No documents needed.
      </p>

      {!kyc.whatsappVerified ? (
        <p
          data-testid="whatsapp-warning"
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
        >
          Verify your WhatsApp number first — buyers reach you there, so it has to work before
          your store can be listed.
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className={LABEL} htmlFor="legalName">Full legal name</label>
          <input id="legalName" name="legalName" defaultValue={kyc.legalName ?? ''} className={FIELD} required />
        </div>
        <div>
          <label className={LABEL} htmlFor="addressLine1">Address</label>
          <input id="addressLine1" name="addressLine1" className={FIELD} required />
        </div>
        <div>
          <label className={LABEL} htmlFor="addressLine2">Address line 2 (optional)</label>
          <input id="addressLine2" name="addressLine2" className={FIELD} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={LABEL} htmlFor="city">City</label>
            <input id="city" name="city" className={FIELD} required />
          </div>
          <div>
            <label className={LABEL} htmlFor="state">State</label>
            <input id="state" name="state" className={FIELD} required />
          </div>
          <div>
            <label className={LABEL} htmlFor="postalCode">PIN code</label>
            <input id="postalCode" name="postalCode" inputMode="numeric" className={FIELD} required />
          </div>
        </div>

        <fieldset className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
          <legend className="px-1 text-[11px] font-bold uppercase tracking-wider text-zinc-600">
            Seller undertaking
          </legend>
          <ul className="mb-3 space-y-1.5 text-[11px] leading-relaxed text-zinc-700">
            {SELLER_UNDERTAKING.map((c) => (
              <li key={c.id} className="flex gap-2">
                <span aria-hidden="true" className="text-[#A77F3A] font-bold">•</span>
                <span>{c.text}</span>
              </li>
            ))}
          </ul>
          <label className="flex items-start gap-2 text-xs font-semibold text-zinc-900">
            <input
              type="checkbox"
              data-testid="accept-undertaking"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5"
            />
            <span>I agree to all of the above.</span>
          </label>
        </fieldset>

        {error ? (
          <p role="alert" data-testid="tier0-error" className="text-xs font-semibold text-red-600">
            {error}
          </p>
        ) : null}
        {done ? (
          <p data-testid="tier0-success" className="text-xs font-semibold text-emerald-700">
            Saved. Your store is now listed in the marketplace.
          </p>
        ) : null}

        <button
          type="submit"
          data-testid="tier0-submit"
          disabled={busy || !accepted}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save and list my store'}
        </button>
      </form>
    </section>
  );
}

function Tier1Section({ kyc, onDone }: { kyc: KycView; onDone: () => void }) {
  const [idType, setIdType] = React.useState<string>(kyc.idType ?? 'PAN');
  const [idNumber, setIdNumber] = React.useState('');
  const [gstin, setGstin] = React.useState(kyc.gstin ?? '');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(kyc.status === 'PENDING_REVIEW');
  const [uploadNote, setUploadNote] = React.useState<string | null>(null);

  // Immediate feedback while typing, so a wrong character is caught in place.
  const liveError = React.useMemo(() => {
    if (!idNumber) return null;
    if (idType === 'PAN') {
      const r = checkPan(idNumber);
      return r.valid ? null : r.error ?? null;
    }
    return null;
  }, [idType, idNumber]);

  const gstinError = React.useMemo(() => {
    if (!gstin) return null;
    const r = checkGstin(gstin);
    return r.valid ? null : r.error ?? null;
  }, [gstin]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadNote('Uploading…');
    const fd = new FormData();
    fd.append('file', file);
    const res = await runAction(() => uploadIdentityDocument(fd));
    setUploadNote(!('success' in res) ? (res.error ?? 'Upload failed.') : 'Document attached.');
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await runAction(() => submitTier1({ idType, idNumber, gstin }));
    if (!('success' in res)) {
      setError(res.error ?? 'Something went wrong.');
      setBusy(false);
      return;
    }
    setSubmitted(true);
    setBusy(false);
    onDone();
  }

  if (kyc.status === 'APPROVED') {
    return (
      <section className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5">
        <h2 className="text-sm font-bold text-emerald-900">Step 2 — Identity verified</h2>
        <p className="mt-1 text-xs text-emerald-800" data-testid="kyc-approved">
          Your identity has been verified and your store carries the verified badge.
          {kyc.idLast4 ? ` Document on file ends ${kyc.idLast4}.` : ''}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-200 p-5">
      <h2 className="text-sm font-bold text-zinc-950">Step 2 — Verified badge (optional)</h2>
      <p className="mb-4 text-xs text-zinc-600">
        Buyers trust a verified store more. We check your document, record only its last four
        characters, and delete the file once a decision is made.
      </p>

      {kyc.status === 'REJECTED' && kyc.rejectionReason ? (
        <p
          data-testid="kyc-rejected"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
        >
          <strong>Not approved:</strong> {kyc.rejectionReason} You can correct it and submit again.
        </p>
      ) : null}

      {submitted && kyc.status !== 'REJECTED' ? (
        <p data-testid="kyc-pending" className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
          Your documents are with our team. We will come back to you.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="idType">Document type</label>
              <select id="idType" data-testid="id-type" value={idType} onChange={(e) => setIdType(e.target.value)} className={FIELD}>
                <option value="PAN">PAN (recommended)</option>
                <option value="PASSPORT">Passport</option>
                <option value="DRIVING_LICENCE">Driving licence</option>
                <option value="VOTER_ID">Voter ID</option>
                <option value="AADHAAR_MASKED">Aadhaar (masked only)</option>
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="idNumber">Document number</label>
              <input
                id="idNumber"
                data-testid="id-number"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value.toUpperCase())}
                className={FIELD}
                required
              />
            </div>
          </div>
          {idType === 'AADHAAR_MASKED' ? (
            <p className="text-[11px] text-amber-800">
              Do not enter a full Aadhaar number. Use the masked form showing only the last four
              digits, or choose PAN instead.
            </p>
          ) : null}
          {liveError ? (
            <p data-testid="id-live-error" className="text-[11px] font-semibold text-red-600">{liveError}</p>
          ) : null}

          <div>
            <label className={LABEL} htmlFor="gstin">GSTIN (only if you are registered)</label>
            <input id="gstin" data-testid="gstin" value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} className={FIELD} />
            {gstinError ? (
              <p data-testid="gstin-error" className="mt-1 text-[11px] font-semibold text-red-600">{gstinError}</p>
            ) : null}
          </div>

          <div>
            <label className={LABEL} htmlFor="kycDoc">Photo of the document</label>
            <input id="kycDoc" data-testid="kyc-doc" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={onUpload} className="text-xs" />
            {uploadNote ? <p data-testid="upload-note" className="mt-1 text-[11px] text-zinc-600">{uploadNote}</p> : null}
          </div>

          {error ? (
            <p role="alert" data-testid="tier1-error" className="text-xs font-semibold text-red-600">{error}</p>
          ) : null}

          <button
            type="submit"
            data-testid="tier1-submit"
            disabled={busy || Boolean(liveError) || Boolean(gstinError)}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-bold text-zinc-900 hover:bg-zinc-50 disabled:opacity-40"
          >
            {busy ? 'Submitting…' : 'Submit for verification'}
          </button>
        </form>
      )}
    </section>
  );
}
