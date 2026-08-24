import { checkPan, checkGstin, normalisePan, normaliseGstin } from '@/shared/lib/kyc';
import { logger } from './logger';

/**
 * Where identity verification happens.
 *
 * Today it is a person in the admin queue. Tomorrow it may be Surepass, Signzy,
 * IDfy, Perfios or whoever is cheapest — those services confirm that a PAN
 * exists and matches a name, which no amount of local validation can do.
 *
 * The seam exists now, before there is a vendor, because retrofitting one means
 * touching every call site. With this in place, adopting a provider is writing
 * one class and setting one environment variable; nothing else changes.
 *
 * The honest distinction this encodes:
 *
 *   `checkPan()`   — is this string shaped like a PAN?           (free, offline)
 *   provider       — does this PAN exist, and whose is it?       (paid, online)
 *
 * The first is validation. Only the second is verification, and only the second
 * justifies telling a buyer a seller is verified.
 */

export type VerificationOutcome =
  /** The identifier exists and matches the name given. */
  | { result: 'match'; nameOnRecord?: string; providerRef?: string }
  /** The identifier exists but the name does not match. */
  | { result: 'mismatch'; nameOnRecord?: string; providerRef?: string }
  /** The identifier does not exist. */
  | { result: 'not_found'; providerRef?: string }
  /** Nothing could be determined — no provider, or the provider failed. */
  | { result: 'undetermined'; reason: string };

export interface KycProvider {
  readonly name: string;
  /** True when this provider can actually reach an authority. */
  readonly isAuthoritative: boolean;
  verifyPan(pan: string, expectedName: string): Promise<VerificationOutcome>;
  verifyGstin(gstin: string, expectedName: string): Promise<VerificationOutcome>;
}

/**
 * The default. Validates shape, then defers to a human.
 *
 * It deliberately never returns `match`. Returning `match` from a format check
 * would put "verified" in front of a buyer on the strength of a regular
 * expression, which is exactly the false assurance this file exists to prevent.
 */
class ManualReviewProvider implements KycProvider {
  readonly name = 'manual';
  readonly isAuthoritative = false;

  async verifyPan(pan: string): Promise<VerificationOutcome> {
    const check = checkPan(pan);
    if (!check.valid) {
      return { result: 'not_found', providerRef: undefined };
    }
    return {
      result: 'undetermined',
      reason: 'No verification provider is configured. A reviewer must confirm this against the document.',
    };
  }

  async verifyGstin(gstin: string): Promise<VerificationOutcome> {
    const check = checkGstin(gstin);
    if (!check.valid) {
      return { result: 'not_found' };
    }
    return {
      result: 'undetermined',
      reason: 'No verification provider is configured. A reviewer must confirm this against the certificate.',
    };
  }
}

/**
 * Skeleton for a real provider. Left unregistered on purpose: wiring an
 * unconfigured HTTP call into the submission path would fail every submission.
 *
 * To adopt one, implement `verifyPan`/`verifyGstin` against the vendor's REST
 * API, register it in `getKycProvider()` below, and set KYC_PROVIDER plus the
 * vendor credentials. Everything upstream is already written against the
 * interface.
 */
export abstract class HttpKycProvider implements KycProvider {
  abstract readonly name: string;
  readonly isAuthoritative = true;
  protected abstract endpoint(path: string): string;
  protected abstract headers(): Record<string, string>;

  protected async post(path: string, body: unknown): Promise<unknown> {
    // 8 seconds: a seller is watching a spinner. Slower than that and the
    // submission should fall back to manual review rather than hang.
    const res = await fetch(this.endpoint(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.headers() },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`${this.name} responded ${res.status}`);
    return res.json();
  }

  abstract verifyPan(pan: string, expectedName: string): Promise<VerificationOutcome>;
  abstract verifyGstin(gstin: string, expectedName: string): Promise<VerificationOutcome>;
}

let cached: KycProvider | null = null;

export function getKycProvider(): KycProvider {
  if (cached) return cached;

  const configured = (process.env.KYC_PROVIDER ?? 'manual').trim().toLowerCase();
  if (configured !== 'manual') {
    // Named a provider that has not been implemented. Fall back rather than
    // throw: a misconfigured environment variable must not stop sellers
    // submitting, it must only stop us claiming their identity was checked.
    logger.warn(
      `KYC_PROVIDER is set to "${configured}", but no such provider is implemented. ` +
        'Falling back to manual review. Identity will not be checked against any authority.'
    );
  }

  cached = new ManualReviewProvider();
  return cached;
}

/**
 * Verify whatever identifier was submitted, never throwing.
 *
 * A provider outage must not lose a seller's submission. An undetermined result
 * simply means the case reaches a human, which is where it was going anyway.
 */
export async function verifyIdentifier(
  kind: 'PAN' | 'GSTIN',
  raw: string,
  expectedName: string
): Promise<VerificationOutcome> {
  const provider = getKycProvider();
  try {
    return kind === 'PAN'
      ? await provider.verifyPan(normalisePan(raw), expectedName)
      : await provider.verifyGstin(normaliseGstin(raw), expectedName);
  } catch (err) {
    logger.error('KYC provider call failed', err, { provider: provider.name, kind });
    return {
      result: 'undetermined',
      reason: 'The verification service could not be reached. A reviewer will check this manually.',
    };
  }
}

/** Test-only: forget the cached provider so a changed env var takes effect. */
export function _resetKycProvider(): void {
  cached = null;
}
