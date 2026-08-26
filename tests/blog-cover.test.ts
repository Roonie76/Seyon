import { describe, it, expect } from 'vitest';
import { checkCoverUrl } from '../src/shared/blog/cover';

/**
 * A cover from an unlisted host is blocked by the Content-Security-Policy and
 * fails silently in the browser. This check moves the failure to the moment
 * the author pastes it, where it can be explained.
 */
describe('checkCoverUrl', () => {
  it('accepts Supabase storage, whatever the project ref', () => {
    expect(checkCoverUrl('https://wcmldqrlppclprpcyjso.supabase.co/storage/v1/object/public/banners/x.jpg').ok).toBe(true);
  });

  it('accepts the two external hosts the policy allows', () => {
    expect(checkCoverUrl('https://images.unsplash.com/photo-1?q=80').ok).toBe(true);
    expect(checkCoverUrl('https://lh3.googleusercontent.com/a/x').ok).toBe(true);
  });

  it('refuses a host the policy would block, and names it', () => {
    const result = checkCoverUrl('https://i.imgur.com/abc.jpg');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('i.imgur.com');
  });

  it('refuses a lookalike host', () => {
    // "notsupabase.co" must not pass a suffix check for ".supabase.co".
    expect(checkCoverUrl('https://evil-supabase.co.attacker.test/x.jpg').ok).toBe(false);
  });

  it('refuses http', () => {
    expect(checkCoverUrl('http://images.unsplash.com/photo-1').ok).toBe(false);
  });

  it('refuses a non-URL', () => {
    expect(checkCoverUrl('not a url').ok).toBe(false);
  });

  it('refuses an empty value', () => {
    expect(checkCoverUrl('').ok).toBe(false);
    expect(checkCoverUrl('   ').ok).toBe(false);
  });

  it('is case-insensitive about the host', () => {
    expect(checkCoverUrl('https://Images.Unsplash.COM/photo-1').ok).toBe(true);
  });
});
