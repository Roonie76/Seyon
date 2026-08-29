/**
 * Validation for a redirect target that came from the URL.
 *
 * `/login` read `?callbackUrl` and handed it straight to `redirect()` and to
 * NextAuth's `redirectTo`, with no check that it pointed back at this site.
 * Reproduced against a signed-in session:
 *
 *   /login?callbackUrl=https://evil.example.com/phish
 *     -> 307  Location: https://evil.example.com/phish
 *   /login?callbackUrl=//example.com/
 *     -> 307  Location: //example.com/
 *   /login?callbackUrl=javascript:alert(1)
 *     -> 307  Location: javascript:alert(1)
 *
 * That is an open redirect. Its value to an attacker is that the link they
 * send begins with the real Seyon domain and a real login page, so it survives
 * the glance a careful person gives a URL, and it lands the victim on a copied
 * login screen a moment after they authenticated for real.
 *
 * Every caller in this codebase passes a site-relative path -- `/wishlist`,
 * `/dashboard`, `/account` -- so relative-only is the whole allow-list.
 * Nothing legitimate needs to leave the origin.
 */

/** Control characters, including tab, newline, carriage return and DEL. */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

/**
 * Returns `raw` when it is a safe same-site path, otherwise `fallback`.
 *
 * Safe means: begins with exactly one `/`, carries no scheme, no backslash and
 * no control characters. The three exclusions are not decorative --
 *
 *   `//evil.com`     is protocol-relative and leaves the origin.
 *   `/\evil.com`     is the same thing to a browser's URL parser, which treats
 *                    a backslash as a slash when reading an authority.
 *   a newline        can be stripped during parsing, so a value split across
 *                    one reassembles into an absolute URL.
 */
export function safeRedirect(raw: string | null | undefined, fallback: string): string {
  if (typeof raw !== 'string') return fallback;

  const value = raw.trim();
  if (value === '') return fallback;

  if (CONTROL_CHARS.test(value)) return fallback;
  if (value.includes('\\')) return fallback;
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//')) return fallback;

  return value;
}
