import { describe, it, expect } from 'vitest';
import { adminOriginFrom } from '../src/shared/lib/site';

/**
 * Where an admin link should point.
 *
 * The nightly digest used to build `${SITE_URL}/admin/reports`. SITE_URL is
 * the shopper origin on the shopper deployment, and `/admin` on the shopper
 * host redirects to the homepage — so the one link in the one email that
 * exists to get an admin to an overdue complaint dropped them on the
 * marketplace instead.
 */
describe('adminOriginFrom', () => {
  const SITE = 'https://shopper.example';

  it('uses the first configured seller host', () => {
    expect(adminOriginFrom('seller.example,other.example', SITE)).toBe('https://seller.example');
  });

  it('tolerates whitespace around the entries', () => {
    expect(adminOriginFrom('  seller.example , other.example ', SITE)).toBe(
      'https://seller.example'
    );
  });

  it('falls back to the site URL when nothing is configured', () => {
    expect(adminOriginFrom(undefined, SITE)).toBe(SITE);
    expect(adminOriginFrom('', SITE)).toBe(SITE);
    expect(adminOriginFrom('   ,  ', SITE)).toBe(SITE);
  });

  it('keeps development on http', () => {
    expect(adminOriginFrom('localhost:3001', SITE)).toBe('http://localhost:3001');
    expect(adminOriginFrom('127.0.0.1:3000', SITE)).toBe('http://127.0.0.1:3000');
  });

  it('does not double the scheme when one was pasted in', () => {
    expect(adminOriginFrom('https://seller.example/', SITE)).toBe('https://seller.example');
  });

  it('never returns a trailing slash, so callers can append a path', () => {
    for (const v of ['seller.example', 'https://seller.example/', undefined]) {
      expect(adminOriginFrom(v, SITE).endsWith('/')).toBe(false);
    }
  });
});
