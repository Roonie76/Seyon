/**
 * The verification loop, as tests.
 *
 * The loop, stated once: the Meta template send fails, the code silently falls
 * back to email, the seller is told "code sent", they confirm it, the shop is
 * recorded as verified via EMAIL — and then Tier 0 refuses to list them and
 * advises them to verify on WhatsApp, which is the thing that just failed.
 * Round again. Nothing in that cycle is an error message, so nothing in it is
 * searchable, and the seller's reasonable conclusion is that their own number
 * is broken.
 *
 * Three things had to become true to end it, and each is tested here:
 *   1. a seller verified by email is told so, at the moment it happens;
 *   2. they are told it is our fault, not their number's;
 *   3. the state is distinguishable from "not verified", because the advice
 *      for the two is different.
 *
 * These render the component rather than reading its source: the failure mode
 * was a branch that did not exist, and the type checker was content.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { KycTier, KycStatus } from '@prisma/client';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/backend/actions/kyc', () => ({
  submitTier0: vi.fn(async () => ({ success: true })),
  submitTier1: vi.fn(async () => ({ success: true })),
  uploadIdentityDocument: vi.fn(async () => ({ success: true })),
}));

vi.mock('@/frontend/lib/run-action', () => ({
  runAction: async (fn: () => Promise<unknown>) => fn(),
}));

import { KycPanel } from '@/frontend/components/dashboard/kyc-panel';

/** As in notice-inbox.test.tsx: createRoot + act, no testing-library peer. */
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

async function mount(ui: React.ReactElement) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(ui);
  });
  return container;
}

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  container?.remove();
  root = null;
  container = null;
});

function kycView(over: Record<string, unknown> = {}) {
  return {
    tier: KycTier.TIER_0,
    status: KycStatus.NOT_STARTED,
    legalName: null,
    idType: null,
    idLast4: null,
    gstin: null,
    rejectionReason: null,
    submittedAt: null,
    reviewedAt: null,
    undertakingAt: null,
    tier0Complete: false,
    whatsappVerified: false,
    isListed: false,
    hasShop: true,
    hasDocument: false,
    whatsappVerifiedOnWhatsapp: false,
    ...over,
  } as never;
}

describe('a seller verified by email is told which state they are in', () => {
  it('warns an unverified seller to verify, and says nothing about email', async () => {
    const el = await mount(<KycPanel initial={kycView()} />);
    expect(el.querySelector('[data-testid="whatsapp-warning"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="whatsapp-email-only-warning"]')).toBeNull();
  });

  it('shows the email-only state as its own state, not as verified', async () => {
    // This is the seller who used to be shown nothing at all: `whatsappVerified`
    // is true, so the "verify first" warning was gone, and there was no second
    // branch. They submitted, and Tier 0 refused them with advice they had no
    // way to anticipate and had already tried.
    const el = await mount(
      <KycPanel
        initial={kycView({ whatsappVerified: true, whatsappVerifiedOnWhatsapp: false })}
      />
    );
    expect(el.querySelector('[data-testid="whatsapp-warning"]')).toBeNull();

    const warning = el.querySelector('[data-testid="whatsapp-email-only-warning"]');
    expect(warning).not.toBeNull();

    const text = warning!.textContent ?? '';
    // Names the cause...
    expect(text).toMatch(/email/i);
    // ...says what it costs them, so the listing refusal is not a surprise...
    expect(text).toMatch(/unlisted|not.*listed/i);
    // ...and puts the fault where it belongs, which is the part that stops
    // them retrying their own number forever.
    expect(text).toMatch(/our side|fault|support/i);
  });

  it('shows neither warning once the number is proved on WhatsApp itself', async () => {
    const el = await mount(
      <KycPanel initial={kycView({ whatsappVerified: true, whatsappVerifiedOnWhatsapp: true })} />
    );
    expect(el.querySelector('[data-testid="whatsapp-warning"]')).toBeNull();
    expect(el.querySelector('[data-testid="whatsapp-email-only-warning"]')).toBeNull();
  });
});
