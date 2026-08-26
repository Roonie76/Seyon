/**
 * Where a blog cover image may come from.
 *
 * The Content-Security-Policy in next.config.ts restricts `img-src` to
 * Supabase storage, Unsplash and Google avatars. A cover pasted from anywhere
 * else is blocked by the browser, and the failure is silent: no error, no
 * broken-image icon in most cases, just an empty hero where the photograph
 * should be. Refusing the URL at save time turns a mystery into a message.
 *
 * Kept as a list rather than read from the CSP string because the two serve
 * different purposes and should be changed deliberately, together. The comment
 * in next.config.ts and this file are documented as mirrors.
 */
export const ALLOWED_IMAGE_HOSTS = [
  'images.unsplash.com',
  'lh3.googleusercontent.com',
] as const;

/** Supabase project hosts are `<ref>.supabase.co`, so match the suffix. */
const SUPABASE_SUFFIX = '.supabase.co';

export interface CoverCheck {
  ok: boolean;
  /** Present when `ok` is false: what to tell the author. */
  reason?: string;
}

export function checkCoverUrl(raw: string): CoverCheck {
  const value = (raw || '').trim();
  if (value === '') return { ok: false, reason: 'A cover image is required.' };

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: 'The cover must be a full URL, starting with https://' };
  }

  if (url.protocol !== 'https:') {
    return { ok: false, reason: 'The cover URL must use https.' };
  }

  const host = url.hostname.toLowerCase();
  const allowed =
    host.endsWith(SUPABASE_SUFFIX) ||
    (ALLOWED_IMAGE_HOSTS as readonly string[]).includes(host);

  if (!allowed) {
    return {
      ok: false,
      reason:
        `Images from ${host} are blocked by the site's content policy and would ` +
        `not load. Upload the image instead, or use a link from ` +
        `${ALLOWED_IMAGE_HOSTS.join(' or ')}.`,
    };
  }

  return { ok: true };
}
