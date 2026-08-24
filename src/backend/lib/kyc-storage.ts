import { supabase, storagePrefixForUser } from './supabase';
import { logger } from './logger';

/**
 * Identity documents.
 *
 * Kept deliberately separate from `supabase.ts`, which serves product imagery.
 * Those three buckets are public and must be — a browser fetches from them on
 * every page. This one is private, and mixing the two in one module is how a
 * refactor eventually writes a passport scan into a public bucket.
 *
 * Rules encoded here rather than left to call sites:
 *
 *  - the bucket is private; there is no public URL for anything in it
 *  - reads happen through short-lived signed URLs, minted server-side only
 *  - every object lives under the owning user's prefix, so a delete can be
 *    proved to stay inside one person's namespace
 *  - the document is deleted once a decision is made. The decision is the
 *    record worth keeping; the image is only liability after that point.
 */

export const KYC_BUCKET = 'kyc-documents';

/** Deliberately short. Long enough for a reviewer to open it, not to share it. */
const SIGNED_URL_TTL_SECONDS = 120;

/** 8 MB. Bigger than any phone photo of a card, smaller than a video. */
export const MAX_KYC_FILE_BYTES = 8 * 1024 * 1024;

export const ALLOWED_KYC_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;

function assertConfigured(): void {
  const url = process.env.SUPABASE_URL ?? '';
  if (!url || url.includes('mock-project')) {
    throw new Error(
      'Identity document storage is not configured (SUPABASE_URL is missing). ' +
        'Refusing to accept documents rather than pretending to store them.'
    );
  }
}

/**
 * Magic-byte check. A file claiming `image/png` in its MIME header proves
 * nothing — the browser sends whatever it is told. This reads the actual bytes,
 * the same defence `api/upload/route.ts` already applies to product images.
 */
export async function looksLikeAllowedDocument(file: File): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const startsWith = (...bytes: number[]) => bytes.every((b, i) => head[i] === b);

  if (startsWith(0xff, 0xd8, 0xff)) return true;                          // JPEG
  if (startsWith(0x89, 0x50, 0x4e, 0x47)) return true;                    // PNG
  if (startsWith(0x25, 0x50, 0x44, 0x46)) return true;                    // %PDF
  if (startsWith(0x52, 0x49, 0x46, 0x46)) return true;                    // RIFF (WebP)
  return false;
}

/** Path for one person's identity document. One document per person at a time. */
export function kycDocumentPath(userId: string, extension: string): string {
  const safeExt = extension.replace(/[^a-z0-9]/gi, '').slice(0, 5).toLowerCase() || 'bin';
  return `${storagePrefixForUser(userId)}/identity.${safeExt}`;
}

export async function uploadKycDocument(userId: string, file: File): Promise<string> {
  assertConfigured();

  if (file.size > MAX_KYC_FILE_BYTES) {
    throw new Error('That file is larger than 8 MB. A photo of the document is enough.');
  }
  if (!(ALLOWED_KYC_TYPES as readonly string[]).includes(file.type)) {
    throw new Error('Upload a JPEG, PNG, WebP or PDF.');
  }
  if (!(await looksLikeAllowedDocument(file))) {
    throw new Error('That file is not the image or PDF it claims to be.');
  }

  const extension = file.name.split('.').pop() ?? 'jpg';
  const path = kycDocumentPath(userId, extension);

  const { error } = await supabase.storage
    .from(KYC_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });

  if (error) {
    logger.error('KYC document upload failed', error, { userId });
    throw new Error('The document could not be uploaded. Please try again.');
  }

  return path;
}

/**
 * A short-lived URL for a reviewer.
 *
 * Callers must have already established that the caller is an admin — this
 * function does not check, because it has no session context. Every call site
 * is in an action that gates on `isCurrentUserAdmin()` first.
 */
export async function signedKycDocumentUrl(path: string): Promise<string | null> {
  assertConfigured();
  const { data, error } = await supabase.storage
    .from(KYC_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    logger.error('Could not sign KYC document URL', error ?? undefined, { path });
    return null;
  }
  return data.signedUrl;
}

/**
 * Remove a document. Called once a decision is recorded.
 *
 * Never throws: a decision must not fail to save because a file could not be
 * deleted. An orphaned object is a cleanup problem; a lost decision is a
 * seller left in limbo.
 */
export async function deleteKycDocument(path: string): Promise<boolean> {
  try {
    assertConfigured();
    const { error } = await supabase.storage.from(KYC_BUCKET).remove([path]);
    if (error) {
      logger.error('KYC document delete failed', error, { path });
      return false;
    }
    return true;
  } catch (err) {
    logger.error('KYC document delete threw', err, { path });
    return false;
  }
}
