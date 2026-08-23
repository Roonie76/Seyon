/**
 * Single source of truth for which hosts may serve product/shop imagery.
 *
 * Two things depend on this list and they must not drift apart:
 *   - next.config.ts `images.remotePatterns` (next/image THROWS on an
 *     unconfigured host, which takes down whichever page rendered the card)
 *   - ProductImageSchema / ShopSchema validation (so an unrenderable URL can
 *     never reach the database in the first place)
 *
 * It also stops the server-side colour-extraction fetch from being pointed at
 * arbitrary hosts — see backend/lib/safe-image-fetch.ts.
 *
 * `*` matches exactly one DNS label, matching next/image's own semantics.
 */

export interface ImageHostPattern {
  protocol: 'https';
  hostname: string;
}

export const ALLOWED_IMAGE_HOSTS: ImageHostPattern[] = [
  { protocol: 'https', hostname: 'images.unsplash.com' },
  { protocol: 'https', hostname: '*.supabase.co' },
];

function hostnameMatches(pattern: string, hostname: string): boolean {
  if (pattern === hostname) return true;
  if (!pattern.startsWith('*.')) return false;
  const suffix = pattern.slice(2);
  if (!hostname.endsWith(`.${suffix}`)) return false;
  const label = hostname.slice(0, hostname.length - suffix.length - 1);
  // `*` is a single label: a.supabase.co matches, a.b.supabase.co does not.
  return label.length > 0 && !label.includes('.');
}

/**
 * True when `raw` is an https URL on a host next/image is configured to render.
 * Everything else — http, javascript:, data:, loopback, private ranges,
 * unknown CDNs — is rejected.
 */
export function isAllowedImageUrl(raw: unknown): boolean {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2048) return false;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }

  if (url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;

  const hostname = url.hostname.toLowerCase();
  return ALLOWED_IMAGE_HOSTS.some(
    (p) => p.protocol === 'https' && hostnameMatches(p.hostname, hostname)
  );
}

export const IMAGE_URL_ERROR =
  'Image must be uploaded through Seyon — external image links are not accepted';
