import { isAllowedImageUrl } from '@/shared/lib/image-hosts';
import { logger } from './logger';

/**
 * Guarded image download for server-side colour extraction.
 *
 * Three things this exists to prevent, all of which were reproducible before:
 *   - SSRF: `fetch(userSuppliedUrl)` will happily call internal services and
 *     cloud metadata endpoints. Only allowlisted image hosts are fetched.
 *   - Hangs: a slow or malformed response held a server action open for 115
 *     seconds. Every request now has a hard deadline.
 *   - Memory: an unbounded body could be any size. The stream is cut off past
 *     MAX_IMAGE_BYTES.
 *
 * Returns null on any failure. Colour extraction is decoration; it must never
 * be able to fail a product save.
 */

export const IMAGE_FETCH_TIMEOUT_MS = 5_000;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB — uploads are capped at 5 MB

export async function safeFetchImage(url: string): Promise<Buffer | null> {
  if (!isAllowedImageUrl(url)) {
    logger.warn('Refused to fetch image from a non-allowlisted host', { url });
    return null;
  }

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
      redirect: 'error', // a redirect could hop to a host the allowlist rejects
      headers: { Accept: 'image/*' },
    });

    if (!res.ok) return null;

    const declared = Number(res.headers.get('content-length') ?? '0');
    if (declared > MAX_IMAGE_BYTES) return null;

    if (!res.body) return null;

    const chunks: Uint8Array[] = [];
    let total = 0;
    const reader = res.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        total += value.byteLength;
        if (total > MAX_IMAGE_BYTES) {
          await reader.cancel();
          return null;
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    return Buffer.concat(chunks);
  } catch (err) {
    // Timeouts, DNS failures, disallowed redirects — all non-fatal.
    logger.warn('Image fetch for colour extraction failed', {
      url,
      reason: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
