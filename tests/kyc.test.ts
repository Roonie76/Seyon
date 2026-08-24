import { describe, it, expect } from 'vitest';
import {
  checkPan,
  checkGstin,
  normalisePan,
  normaliseGstin,
  lastFour,
  maskIdentifier,
} from '@/shared/lib/kyc';
import {
  SELLER_UNDERTAKING,
  SELLER_UNDERTAKING_VERSION,
  undertakingPlainText,
} from '@/shared/data/seller-undertaking';

/**
 * These functions decide whether a seller's identity reaches a reviewer at all,
 * so a false accept wastes a person's time and a false reject turns a real
 * seller away. Both matter.
 */

describe('PAN', () => {
  it('accepts a well-formed PAN and reports the holder type', () => {
    const r = checkPan('ABCPE1234F');
    expect(r.valid).toBe(true);
    expect(r.holderType).toBe('Individual');
  });

  it('reads the holder type from the fourth character', () => {
    expect(checkPan('ABCCE1234F').holderType).toBe('Company');
    expect(checkPan('ABCHE1234F').holderType).toBe('Hindu Undivided Family');
    expect(checkPan('ABCFE1234F').holderType).toBe('Firm');
    expect(checkPan('ABCEE1234F').holderType).toBe('Limited Liability Partnership');
    expect(checkPan('ABCTE1234F').holderType).toBe('Trust');
  });

  it('normalises spacing and case before judging', () => {
    expect(normalisePan(' abcpe 1234 f ')).toBe('ABCPE1234F');
    expect(checkPan(' abcpe1234f ').valid).toBe(true);
  });

  it.each([
    ['', 'empty'],
    ['ABCPE1234', 'too short'],
    ['ABCPE1234FG', 'too long'],
    ['ABCD01234F', 'digit among the leading letters'],
    ['ABCPE123AF', 'letter among the digits'],
    ['ABCPE12345', 'digit in the final position'],
  ])('rejects %j (%s)', (value) => {
    expect(checkPan(value).valid).toBe(false);
  });

  it('rejects an invalid holder-type character with a specific message', () => {
    // 'X' is not a recognised holder type; shape alone would accept this.
    const r = checkPan('ABCXE1234F');
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/fourth character/i);
  });

  it('offers an example in its error that its own validator accepts', () => {
    // The message used to suggest ABCDE1234F, which this validator rejects:
    // 'D' is not a PAN holder-type character. A seller copying the example
    // would have been told their correct-looking PAN was wrong.
    // Ten characters, so it reaches the format branch where the example lives.
    const message = checkPan('1234567890').error ?? '';
    const example = message.match(/\b([A-Z]{5}[0-9]{4}[A-Z])\b/)?.[1];
    expect(example).toBeTruthy();
    expect(checkPan(example!).valid).toBe(true);
  });

  it('always explains why, never just fails', () => {
    for (const bad of ['', 'nope', 'ABCXE1234F', 'ABCPE1234']) {
      const r = checkPan(bad);
      expect(r.valid).toBe(false);
      expect(r.error && r.error.length).toBeGreaterThan(10);
    }
  });
});

describe('GSTIN', () => {
  // Verified against the published mod-36 algorithm: the check character these
  // compute matches the one they carry.
  const VALID = ['27AAPFU0939F1ZV', '29AAGCB7383J1Z4'];

  it.each(VALID)('accepts %s', (g) => {
    expect(checkGstin(g).valid).toBe(true);
  });

  it('extracts the embedded PAN and state code', () => {
    const r = checkGstin('27AAPFU0939F1ZV');
    expect(r.embeddedPan).toBe('AAPFU0939F');
    expect(r.stateCode).toBe('27');
    // The embedded PAN must itself be a valid PAN.
    expect(checkPan(r.embeddedPan!).valid).toBe(true);
  });

  it('normalises spacing and case', () => {
    expect(normaliseGstin(' 27aapfu0939f1zv ')).toBe('27AAPFU0939F1ZV');
    expect(checkGstin(' 27aapfu0939f1zv ').valid).toBe(true);
  });

  it('rejects a wrong check digit', () => {
    const r = checkGstin('27AAPFU0939F1ZZ'); // last character altered
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/check digit/i);
  });

  it('catches every single-character corruption', () => {
    const good = '27AAPFU0939F1ZV';
    const charset = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let tested = 0;
    for (let i = 0; i < 14; i++) {
      for (const c of charset) {
        if (c === good[i]) continue;
        const mutated = good.slice(0, i) + c + good.slice(i + 1);
        // Skip mutations that break the structural shape — those are rejected
        // by the format rule rather than the checksum, which is also correct.
        if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(mutated)) continue;
        tested++;
        expect(checkGstin(mutated).valid).toBe(false);
      }
    }
    expect(tested).toBeGreaterThan(50);
  });

  it('catches adjacent transpositions, which a format check would miss', () => {
    const good = '27AAPFU0939F1ZV';
    let tested = 0;
    for (let i = 0; i < 13; i++) {
      if (good[i] === good[i + 1]) continue;
      const swapped = good.slice(0, i) + good[i + 1] + good[i] + good.slice(i + 2);
      if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(swapped)) continue;
      tested++;
      expect(checkGstin(swapped).valid).toBe(false);
    }
    expect(tested).toBeGreaterThan(3);
  });

  it.each([['', 'empty'], ['27AAPFU0939F1Z', 'too short'], ['27AAPFU0939F1ZVX', 'too long']])(
    'rejects %j (%s)',
    (value) => {
      expect(checkGstin(value).valid).toBe(false);
    }
  );
});

describe('identifier masking', () => {
  it('keeps only the last four characters', () => {
    expect(lastFour('ABCPE1234F')).toBe('234F');
    expect(maskIdentifier('ABCPE1234F')).toBe('••••••234F');
  });

  it('does not over-mask something already short', () => {
    expect(lastFour('AB')).toBe('AB');
    expect(maskIdentifier('AB')).toBe('AB');
  });

  it('never leaks a character beyond the last four', () => {
    const pan = 'ABCPE1234F';
    const masked = maskIdentifier(pan);
    // The first six characters must not survive anywhere in the masked form.
    expect(masked).not.toContain('ABCPE1');
    expect(masked.replace(/•/g, '')).toBe('234F');
  });
});

describe('seller undertaking', () => {
  it('is versioned, so a rewrite cannot claim someone agreed to new words', () => {
    expect(SELLER_UNDERTAKING_VERSION).toMatch(/^\d{4}-\d{2}-\d+$/);
  });

  it('covers what the e-commerce rules require a seller to undertake', () => {
    const text = undertakingPlainText().toLowerCase();
    expect(text).toContain('accurate');       // descriptions correspond to goods
    expect(text).toContain('right to sell');  // no counterfeit or prohibited goods
    expect(text).toContain('counterfeit');
    expect(text).toContain('return');         // seller's own return terms
  });

  it('states plainly that Seyon does not take payment or fulfil', () => {
    const text = undertakingPlainText().toLowerCase();
    expect(text).toContain('does not process payments');
  });

  it('has stable clause ids, so acceptance records stay meaningful', () => {
    const ids = SELLER_UNDERTAKING.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('accuracy');
    expect(ids).toContain('identity');
  });
});
