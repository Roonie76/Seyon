/**
 * `/login?callbackUrl=` was an open redirect.
 *
 * Reproduced against a real signed-in session on a running server: the page
 * answered 307 with `Location: https://evil.example.com/phish`, verbatim from
 * the query string. Three sinks read the same value — `redirect()` and both
 * `signIn({ redirectTo })` calls — so validating once, where the parameter is
 * read, closes all three.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { safeRedirect } from '@/shared/lib/safe-redirect';

const FALLBACK = '/marketplace';

describe('safeRedirect', () => {
  it('refuses anything that can leave the origin', () => {
    const hostile = [
      // Absolute URLs.
      'https://evil.example.com/phish',
      'http://evil.example.com',
      'HTTPS://EVIL.EXAMPLE.COM',
      // Protocol-relative.
      '//evil.example.com',
      '//evil.example.com/login',
      '///evil.example.com',
      // Backslash variants: a browser reads `\` as `/` in an authority.
      '/\\evil.example.com',
      '\\\\evil.example.com',
      'https:/\\evil.example.com',
      '/path\\..\\..',
      // Non-http schemes.
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd',
      'mailto:someone@example.com',
      // Control characters, which a URL parser may strip and rejoin.
      '/\u0000//evil.example.com',
      '/\nhttps://evil.example.com',
      '/\rhttps://evil.example.com',
      '/\thttps://evil.example.com',
      'java\nscript:alert(1)',
      // Not a path at all.
      'dashboard',
      'evil.example.com',
      '',
      '   ',
    ];
    for (const value of hostile) {
      expect(safeRedirect(value, FALLBACK), `callbackUrl=${JSON.stringify(value)}`).toBe(FALLBACK);
    }
  });

  it('falls back when the parameter is absent or not a string', () => {
    expect(safeRedirect(undefined, FALLBACK)).toBe(FALLBACK);
    expect(safeRedirect(null, FALLBACK)).toBe(FALLBACK);
    expect(safeRedirect(123 as unknown as string, FALLBACK)).toBe(FALLBACK);
  });

  it('passes through the site-relative paths the app actually uses', () => {
    for (const value of [
      '/dashboard',
      '/wishlist',
      '/account',
      '/verification',
      '/contact',
      '/marketplace',
      '/store/some-shop/some-product',
      '/?q=silk&page=2',
      '/blog/topic/jewellery#care',
    ]) {
      expect(safeRedirect(value, FALLBACK), `callbackUrl=${value}`).toBe(value);
    }
  });

  it('never returns a value that a URL parser resolves off-origin', () => {
    const origin = 'https://seyon.example';
    const candidates = [
      'https://evil.example.com/phish',
      '//evil.example.com',
      '/\\evil.example.com',
      '/dashboard',
      '/wishlist',
      'javascript:alert(1)',
    ];
    for (const value of candidates) {
      const resolved = new URL(safeRedirect(value, FALLBACK), origin);
      expect(resolved.origin, `callbackUrl=${value}`).toBe(origin);
    }
  });
});

describe('the login page uses it', () => {
  const LOGIN_RAW = readFileSync(join(__dirname, '..', 'src/app/login/page.tsx'), 'utf8');
  /** The comment describing the bug quotes the old code, and would match. */
  const LOGIN = LOGIN_RAW.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('validates the parameter rather than defaulting it', () => {
    expect(LOGIN).not.toContain('params.callbackUrl || defaultCallback');
    expect(LOGIN).toContain('safeRedirect(params.callbackUrl, defaultCallback)');
  });

  it('reads the raw parameter exactly once, so no sink can miss the check', () => {
    // Three sinks consume `callbackUrl`: `redirect()` and both `signIn()`
    // calls. If a later change reads the searchParam again anywhere, it has
    // bypassed the validation and this fails.
    const rawReads = LOGIN.match(/params\.callbackUrl/g) ?? [];
    expect(rawReads).toHaveLength(1);
  });
});
