import { createClient } from '@supabase/supabase-js';
import { logger } from './logger';

export type StorageBucket = 'logos' | 'banners' | 'products' | 'avatars';

const supabaseUrl = process.env.SUPABASE_URL || 'https://mock-project.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-role-key';

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Whether real storage is configured.
 *
 * When it is not, uploads used to return a random Unsplash stock photo and
 * report success — so a missing SUPABASE_URL in production would have filled
 * the catalogue with images of products nobody sells, with nothing in the UI
 * to indicate it. The mock path is now development-only and production fails
 * loudly instead.
 */
const isStorageConfigured =
  Boolean(process.env.SUPABASE_URL) && !supabaseUrl.includes('mock-project');

function assertStorageUsable(): void {
  if (isStorageConfigured) return;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Image storage is not configured (SUPABASE_URL is missing). Refusing to accept uploads.'
    );
  }
}

/**
 * Files are written under a per-owner prefix so a delete can be proved to stay
 * inside the caller's own namespace. Before this, buckets were a flat
 * namespace and `deleteFile` would remove any path it was handed.
 */
export function storagePrefixForShop(shopId: string): string {
  return `shop_${shopId}`;
}

export function storagePrefixForUser(userId: string): string {
  return `user_${userId}`;
}

/** Extract the in-bucket path from a public storage URL, or null. */
export function storagePathFromUrl(fileUrl: string, bucket: StorageBucket): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = fileUrl.indexOf(marker);
  if (idx === -1) return null;
  const path = fileUrl.slice(idx + marker.length);
  return path.length > 0 ? decodeURIComponent(path) : null;
}

export async function uploadFile(
  file: File,
  bucket: StorageBucket,
  /** Owner namespace, e.g. storagePrefixForShop(shop.id). */
  prefix?: string
): Promise<string> {
  assertStorageUsable();

  // Local development without Supabase credentials: stand in a placeholder so
  // the flow is exercisable. Never reachable in production (see above).
  if (!isStorageConfigured) {
    logger.warn('SUPABASE_URL is not set — returning a development placeholder image');
    const randomId = Math.floor(Math.random() * 1000);
    if (bucket === 'logos') {
      return `https://images.unsplash.com/photo-1546054454-aa26e2b734c7?auto=format&fit=crop&w=150&h=150&q=80&mock=${randomId}`;
    } else if (bucket === 'banners') {
      return `https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&h=400&q=80&mock=${randomId}`;
    } else if (bucket === 'avatars') {
      return `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&h=200&q=80&mock=${randomId}`;
    } else {
      return `https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&h=450&q=80&mock=${randomId}`;
    }
  }

  // Convert File to ArrayBuffer for Node environment compatibility in Server Actions
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Map file content-type to verified safe extensions to prevent extension spoofing
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  const fileExt = mimeToExt[file.type] || 'jpg';
  const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
  const safePrefix = prefix ? prefix.replace(/[^a-zA-Z0-9_-]/g, '') : '';
  const filePath = safePrefix ? `${safePrefix}/${fileName}` : fileName;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, buffer, {
      contentType: file.type,
      cacheControl: '31536000',
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase upload error: ${error.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}

/**
 * Remove a stored file.
 *
 * `requiredPrefix`, when given, is enforced: the object must live inside that
 * owner's namespace. This is what stops a seller from handing us another
 * shop's public image URL and having it deleted.
 */
export async function deleteFile(
  fileUrl: string,
  bucket: StorageBucket,
  requiredPrefix?: string
): Promise<void> {
  if (!isStorageConfigured) {
    logger.debug('Storage not configured — skipping delete', { fileUrl });
    return;
  }

  const filePath = storagePathFromUrl(fileUrl, bucket);
  if (!filePath) return;

  if (requiredPrefix) {
    const expected = `${requiredPrefix.replace(/[^a-zA-Z0-9_-]/g, '')}/`;
    if (!filePath.startsWith(expected)) {
      // Legacy files predate the prefix scheme; the caller has already checked
      // that no other shop references them. Anything else is refused.
      if (filePath.includes('/')) {
        logger.warn('Refused to delete a file outside the caller namespace', {
          filePath,
          expected,
        });
        return;
      }
    }
  }

  const { error } = await supabase.storage.from(bucket).remove([filePath]);
  if (error) {
    logger.error('Supabase deletion error', error, { fileUrl });
  }
}
