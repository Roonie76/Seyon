/**
 * F-01 — Demo Data Service isolation.
 *
 * The guardrail in src/lib/demo.ts only covers the demo module itself; page
 * components add their own hard-coded fallbacks (`shop.reviewCount || 100`,
 * a literal "4.9 (124 reviews)" hero rating). These tests pin the rule:
 * nothing that is not backed by real data may be rendered as social proof.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('F-01 no fabricated social proof in shopper pages', () => {
  const pages = [
    'src/app/(shopper)/page.tsx',
    'src/app/(shopper)/creators/page.tsx',
  ];

  it.each(pages)('%s does not fall back to an invented review count', (p) => {
    expect(read(p)).not.toMatch(/reviewCount\s*\|\|\s*\d+/);
  });

  it.each(pages)('%s does not hard-code a star rating or review count', (p) => {
    expect(read(p)).not.toMatch(/⭐\s*\d+\.\d+\s*<span[^>]*>\(\d+\s*reviews?\)/);
  });
});

describe('F-01b demo module must not invent values outside development', () => {
  it('getCreatorPresentation returns no rating for an unrated shop in production', async () => {
    const prev = process.env.NODE_ENV;
    // @ts-expect-error test-only override
    process.env.NODE_ENV = 'production';
    const mod = await import('@/lib/demo');
    const p = mod.getCreatorPresentation({ id: 'x', name: 'New Shop', slug: 'new-shop', averageRating: 0 });
    expect(p.rating).toBeFalsy();          // must not default to 4.8
    expect(p.location).toBeFalsy();        // must not default to "Mumbai"
    expect(p.trustTag).not.toBe('Verified Creator'); // must not claim verification
    // @ts-expect-error restore
    process.env.NODE_ENV = prev;
  });
});

describe('F-09 storage misconfiguration must fail loudly, not silently mock', () => {
  it('supabase.uploadFile has no unconditional stock-photo fallback', () => {
    const src = read('src/backend/lib/supabase.ts');
    const mockBranch = /mock-project|!process\.env\.SUPABASE_URL/.test(src);
    if (mockBranch) {
      // If a mock path exists it must be gated on a non-production environment.
      expect(src).toMatch(/NODE_ENV\s*[!=]==\s*'(production|development|test)'/);
    }
  });
});

describe('F-11 passwordless dev login must be impossible in a production build', () => {
  it('isDevLoginEnabled is gated on NODE_ENV, not only an env flag', () => {
    const src = read('src/backend/lib/dev-login.ts');
    expect(src).toMatch(/NODE_ENV/);
  });
});
