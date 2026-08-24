/**
 * Seller identity validation.
 *
 * Pure functions, no I/O, shared by the client form and the server action so a
 * seller sees the same verdict twice rather than passing the browser check and
 * failing on submit.
 *
 * Deliberately narrow. These confirm that an identifier is *well-formed* — that
 * it could exist. They cannot confirm it belongs to the person typing it; only a
 * government-backed lookup does that, which is what `kyc-provider.ts` is for.
 * Saying "PAN verified" on the strength of a format check would be a lie.
 */

/** Format only: five letters, four digits, one letter. */
const PAN_SHAPE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/**
 * The fourth character encodes the holder type. Anything outside this set is a
 * typo rather than a real PAN, which is worth catching before a human reviews it.
 */
const PAN_HOLDER_TYPES: Record<string, string> = {
  P: 'Individual',
  C: 'Company',
  H: 'Hindu Undivided Family',
  F: 'Firm',
  E: 'Limited Liability Partnership',
  A: 'Association of Persons',
  T: 'Trust',
  B: 'Body of Individuals',
  L: 'Local Authority',
  J: 'Artificial Juridical Person',
  G: 'Government',
  K: 'Krish (Trust under Wealth Tax Act)',
};

export interface PanCheck {
  valid: boolean;
  holderType?: string;
  error?: string;
}

export function normalisePan(raw: string): string {
  return String(raw ?? '').replace(/\s+/g, '').toUpperCase();
}

export function checkPan(raw: string): PanCheck {
  const pan = normalisePan(raw);
  if (!pan) return { valid: false, error: 'Enter your PAN.' };
  if (pan.length !== 10) return { valid: false, error: 'A PAN is exactly 10 characters.' };
  if (!PAN_SHAPE.test(pan)) {
    return { valid: false, error: 'That is not a PAN. The format is five letters, four digits, then one letter — for example ABCPE1234F.' };
  }

  const holderType = PAN_HOLDER_TYPES[pan[3]];
  if (!holderType) {
    return { valid: false, error: 'The fourth character of a PAN identifies the holder type, and that one is not a valid type. Check for a typo.' };
  }

  return { valid: true, holderType };
}

const GSTIN_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const GSTIN_SHAPE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;

export interface GstinCheck {
  valid: boolean;
  /** The PAN embedded in characters 3-12 of every GSTIN. */
  embeddedPan?: string;
  stateCode?: string;
  error?: string;
}

export function normaliseGstin(raw: string): string {
  return String(raw ?? '').replace(/\s+/g, '').toUpperCase();
}

/**
 * GSTIN carries a real check digit, unlike PAN. Verifying it costs nothing and
 * rejects transposed characters that a format check waves through.
 *
 * Algorithm: each of the first 14 characters is weighted alternately 1 and 2;
 * each product's quotient and remainder against 36 are summed; the check
 * character is whatever brings the total to a multiple of 36.
 */
export function checkGstin(raw: string): GstinCheck {
  const gstin = normaliseGstin(raw);
  if (!gstin) return { valid: false, error: 'Enter your GSTIN.' };
  if (gstin.length !== 15) return { valid: false, error: 'A GSTIN is exactly 15 characters.' };
  if (!GSTIN_SHAPE.test(gstin)) {
    return { valid: false, error: 'That is not the shape of a GSTIN. Check for a typo.' };
  }

  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const value = GSTIN_CHARSET.indexOf(gstin[i]);
    if (value < 0) return { valid: false, error: 'That is not the shape of a GSTIN. Check for a typo.' };
    const factor = i % 2 === 0 ? 1 : 2;
    const product = value * factor;
    sum += Math.floor(product / 36) + (product % 36);
  }
  const expected = GSTIN_CHARSET[(36 - (sum % 36)) % 36];

  if (expected !== gstin[14]) {
    return {
      valid: false,
      error: 'That GSTIN fails its own check digit, so at least one character is wrong. Please re-read it from your certificate.',
    };
  }

  return { valid: true, embeddedPan: gstin.slice(2, 12), stateCode: gstin.slice(0, 2) };
}

/**
 * Last four characters, for showing a seller which identifier is on file
 * without holding the whole thing in a readable column.
 */
export function lastFour(raw: string): string {
  const s = String(raw ?? '');
  return s.length <= 4 ? s : s.slice(-4);
}

/** Display form: all but the last four masked. */
export function maskIdentifier(raw: string): string {
  const s = String(raw ?? '');
  if (s.length <= 4) return s;
  return '•'.repeat(s.length - 4) + s.slice(-4);
}
