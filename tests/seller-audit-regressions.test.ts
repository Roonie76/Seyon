/**
 * The seller-side audit, as tests.
 *
 * One case per defect that could come back silently — the ones where the wrong
 * behaviour still returns success, still typechecks, and is only visible if you
 * know to look. The findings that are structural (a missing `select`, a removed
 * action, a guard added to a route) are covered by the type system or by the
 * tests that already exist, and are not repeated here.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normaliseProductImages } from '../src/shared/lib/product-images';
import { istDayStart, istDayKey, istDayLabel, lastIstDays } from '../src/shared/lib/ist';
import { appSecret, resetAppSecretCache } from '../src/backend/lib/app-secret';
import { roleAfterShopRemoval } from '../src/shared/lib/shop-removal';
import { DISCOVERABLE_SHOP } from '../src/backend/lib/shop-visibility';
import { SELLER_SHOP_SELECT } from '../src/backend/lib/seller-shop-view';
import { normaliseWhatsapp } from '../src/shared/lib/whatsapp-number';
import { Role } from '@prisma/client';

describe('the cover image a seller picks is the one buyers see', () => {
  it('moves the chosen primary to displayOrder 0', () => {
    // Every public card query orders by displayOrder and takes images[0]; the
    // dashboard star only ever set isPrimary. Starring the third photo changed
    // the dashboard and the gallery and nothing else — including the OpenGraph
    // image, which is the WhatsApp link preview.
    const out = normaliseProductImages([
      { url: 'a.jpg' },
      { url: 'b.jpg' },
      { url: 'c.jpg', isPrimary: true },
    ]);
    expect(out[0]).toEqual({ url: 'c.jpg', displayOrder: 0, isPrimary: true });
    expect(out.map((i) => i.url)).toEqual(['c.jpg', 'a.jpg', 'b.jpg']);
  });

  it('always produces exactly one primary', () => {
    // ProductImageSchema defaults isPrimary to false, which made the
    // `?? (idx === 0)` fallbacks in the actions dead code: a direct action call
    // with no flags created a product with zero primaries, all at displayOrder 0.
    for (const input of [
      [{ url: 'a.jpg' }, { url: 'b.jpg' }],
      [{ url: 'a.jpg', isPrimary: false }, { url: 'b.jpg', isPrimary: false }],
      [{ url: 'a.jpg', isPrimary: true }, { url: 'b.jpg', isPrimary: true }],
    ]) {
      const out = normaliseProductImages(input);
      expect(out.filter((i) => i.isPrimary)).toHaveLength(1);
      expect(out[0].isPrimary).toBe(true);
    }
  });

  it('gives every image a distinct order', () => {
    const out = normaliseProductImages([
      { url: 'a.jpg', displayOrder: 0 },
      { url: 'b.jpg', displayOrder: 0 },
      { url: 'c.jpg', displayOrder: 0 },
    ]);
    expect(out.map((i) => i.displayOrder)).toEqual([0, 1, 2]);
  });

  it('falls back to the first image when nothing is flagged', () => {
    const out = normaliseProductImages([{ url: 'a.jpg' }, { url: 'b.jpg' }]);
    expect(out[0].url).toBe('a.jpg');
  });

  it('survives an empty list', () => {
    expect(normaliseProductImages([])).toEqual([]);
  });
});

describe('a day is a day in India', () => {
  it('puts 01:00 IST in the same day as 23:00 IST', () => {
    // The chart bucketed with setHours(), which is UTC on Vercel, so every day
    // ran 05:30 to 05:30 — an evening tap landed in the wrong bar.
    const lateEvening = new Date('2026-09-03T17:30:00Z'); // 23:00 IST on the 3rd
    const smallHours = new Date('2026-09-03T19:30:00Z'); // 01:00 IST on the 4th
    expect(istDayKey(lateEvening)).toBe('2026-09-03');
    expect(istDayKey(smallHours)).toBe('2026-09-04');
  });

  it('starts the day at 18:30 UTC the evening before', () => {
    const start = istDayStart(new Date('2026-09-03T12:00:00Z'));
    expect(start.toISOString()).toBe('2026-09-02T18:30:00.000Z');
  });

  it('returns the requested number of consecutive days, oldest first', () => {
    const days = lastIstDays(7, new Date('2026-09-03T12:00:00Z'));
    expect(days).toHaveLength(7);
    expect(istDayKey(days[6])).toBe('2026-09-03');
    expect(istDayKey(days[0])).toBe('2026-08-28');
    for (let i = 1; i < days.length; i += 1) {
      expect(days[i].getTime() - days[i - 1].getTime()).toBe(86_400_000);
    }
  });

  it('labels in Indian format, not American', () => {
    // The axis read "Thu, Sep 3" for an India-only marketplace.
    const label = istDayLabel(new Date('2026-09-03T12:00:00Z'));
    expect(label).toMatch(/3/);
    expect(label).toMatch(/Sep/);
    // en-IN puts the day before the month; en-US does the reverse.
    expect(label.indexOf('3')).toBeLessThan(label.indexOf('Sep'));
  });
});

describe('the application secret', () => {
  it('refuses to fall back to a default', () => {
    // kyc.ts salted the identity hash with `AUTH_SECRET ?? ''` and whatsapp.ts
    // keyed the code HMAC with `NEXTAUTH_SECRET || 'local-dev-secret'`, while
    // env-check passed if either name was set. Setting only one produced either
    // an unsalted PAN hash or an HMAC keyed on a string in this repository —
    // both booting cleanly, neither detectable at runtime.
    const before = { a: process.env.AUTH_SECRET, n: process.env.NEXTAUTH_SECRET };
    try {
      resetAppSecretCache();
      delete process.env.AUTH_SECRET;
      delete process.env.NEXTAUTH_SECRET;
      expect(() => appSecret()).toThrow(/AUTH_SECRET/);
    } finally {
      if (before.a !== undefined) process.env.AUTH_SECRET = before.a;
      if (before.n !== undefined) process.env.NEXTAUTH_SECRET = before.n;
      resetAppSecretCache();
    }
  });

  it('accepts either name, so a legacy deployment still boots', () => {
    const before = { a: process.env.AUTH_SECRET, n: process.env.NEXTAUTH_SECRET };
    try {
      resetAppSecretCache();
      delete process.env.AUTH_SECRET;
      process.env.NEXTAUTH_SECRET = 'a-legacy-secret';
      expect(appSecret()).toBe('a-legacy-secret');
    } finally {
      if (before.a !== undefined) process.env.AUTH_SECRET = before.a;
      if (before.n === undefined) delete process.env.NEXTAUTH_SECRET;
      else process.env.NEXTAUTH_SECRET = before.n;
      resetAppSecretCache();
    }
  });
});

describe('discovery cannot drift from verification', () => {
  it('requires a WhatsApp-channel confirmation, not merely a timestamp', () => {
    // Two separate ways a listed store ended up with an unproven number:
    // editing the number nulled whatsappVerifiedAt and left isListed alone, and
    // a code read out of the seller's own inbox set the same timestamp a real
    // WhatsApp confirmation would.
    expect(DISCOVERABLE_SHOP.whatsappVerifiedAt).toEqual({ not: null });
    expect(DISCOVERABLE_SHOP.whatsappVerifiedVia).toBe('WHATSAPP');
  });

  it('still hides suspended, paused, unlisted and under-review stores', () => {
    expect(DISCOVERABLE_SHOP.isSuspended).toBe(false);
    expect(DISCOVERABLE_SHOP.isPaused).toBe(false);
    expect(DISCOVERABLE_SHOP.isListed).toBe(true);
    expect(DISCOVERABLE_SHOP.isUnderReview).toBe(false);
  });
});

describe('what the seller may be told about their own shop', () => {
  it('never sends the moderation columns to the browser', () => {
    // The dashboard loaded the bare row and handed it to a client component, so
    // isUnderReview and the moderator's free-text reason were in the page
    // payload — the one thing that state exists to prevent.
    for (const secret of [
      'isUnderReview',
      'underReviewReason',
      'underReviewSince',
      'underReviewById',
    ]) {
      expect(SELLER_SHOP_SELECT).not.toHaveProperty(secret);
    }
  });

  it('does include what the seller is entitled to know', () => {
    // Suspension and listing are the seller's own status and are shown to them
    // directly; leaving them out would recreate the "invisible and never told"
    // problem from the other direction.
    expect(SELLER_SHOP_SELECT.isSuspended).toBe(true);
    expect(SELLER_SHOP_SELECT.isListed).toBe(true);
  });
});

describe('deleting a store does not delete admin access', () => {
  it('steps a seller down and leaves everyone else alone', () => {
    expect(roleAfterShopRemoval(Role.SELLER)).toBe(Role.USER);
    expect(roleAfterShopRemoval(Role.ADMIN)).toBeNull();
    expect(roleAfterShopRemoval(Role.USER)).toBeNull();
  });
});

describe('a profile save is not mistaken for a number change', () => {
  it('treats a stored number and its normalised form as the same number', () => {
    // `ShopSchema` normalises on the way in, so comparing the parsed value
    // against a raw stored one reported a change on every save of any shop
    // whose number predated that rule — and a changed number unlists the store.
    // A seller editing their city would have vanished from the marketplace.
    expect(normaliseWhatsapp('919700000001')).toBe(normaliseWhatsapp('+919700000001'));
    expect(normaliseWhatsapp('9700000001')).toBe('+919700000001');
    expect(normaliseWhatsapp('+91 97000 00001')).toBe('+919700000001');
  });

  it('still sees a genuinely different number as different', () => {
    expect(normaliseWhatsapp('919700000001')).not.toBe(normaliseWhatsapp('919700000002'));
  });
});

describe('the role escalation stays closed', () => {
  /**
   * A source scan, deliberately.
   *
   * This is the one finding with no behavioural test, because reproducing it
   * needs a running server, a signed-in session and a POST to
   * /api/auth/session — and the first version of that probe passed against the
   * vulnerable code, which is worse than no test at all.
   *
   * What can be asserted cheaply is the shape of the callback. In Auth.js v5
   * the `session` argument on an `update` trigger is the raw body the client
   * posted, so any assignment from it into `token.role` hands the caller their
   * own role. Nothing in this codebase calls `useSession().update()`, so there
   * is no legitimate reason for that branch to exist.
   *
   * The reason this is worth a test rather than a comment: the next `next-auth`
   * bump is a diff in a file nobody reads closely, and a merge that restores
   * the branch would be silent. This file is the thing that shouts.
   */
  // `import.meta.url` is not a file: URL under this vitest transform, so the
  // path is resolved from the project root instead.
  const authSource = readFileSync(
    resolve(process.cwd(), 'src/backend/lib/auth.ts'),
    'utf8'
  );

  /** Comments explain the removal, so they must not count as the code returning. */
  const code = authSource
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  it('never writes the client-supplied session payload onto the token role', () => {
    expect(code).not.toMatch(/token\.role\s*=\s*session[.?[]/);
  });

  it('does not reintroduce an update-trigger branch', () => {
    expect(code).not.toMatch(/trigger\s*===\s*['"]update['"]/);
  });

  it('still sets the role from the database user at sign-in', () => {
    // The guard above must not be satisfiable by deleting the callback wholesale.
    expect(code).toMatch(/token\.role\s*=\s*\(user as/);
  });
});
