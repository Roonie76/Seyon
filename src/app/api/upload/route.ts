import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/backend/lib/session';
import {
  uploadFile,
  storagePrefixForShop,
  storagePrefixForUser,
  storagePathFromUrl,
} from '@/lib/supabase';
import { db } from '@/lib/db';
import { rateLimit, RATE_LIMITS } from '@/backend/lib/rate-limit';
import { logger } from '@/backend/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = await rateLimit(`upload:${session.user.id}`, RATE_LIMITS.UPLOAD.limit, RATE_LIMITS.UPLOAD.windowMs);
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Upload limit reached. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const bucket = formData.get('bucket') as 'logos' | 'banners' | 'products' | 'avatars' | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!bucket || !['logos', 'banners', 'products', 'avatars'].includes(bucket)) {
      return NextResponse.json({ error: 'Invalid or missing upload bucket category' }, { status: 400 });
    }

    // Validate file size and type
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 5MB limit' }, { status: 400 });
    }

    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Unsupported file format. Use JPEG, PNG, WEBP, or GIF' }, { status: 400 });
    }

    // Validate magic bytes server-side
    const fileTypeModule = await import('file-type');
    const fromBufferFn = fileTypeModule.fromBuffer || (fileTypeModule as Record<string, { fromBuffer?: unknown }>).default?.fromBuffer;
    if (typeof fromBufferFn !== 'function') {
      throw new Error('file-type fromBuffer is not a function');
    }
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const detectedType = await fromBufferFn(buffer);

    if (!detectedType || !ALLOWED_TYPES.includes(detectedType.mime)) {
      return NextResponse.json({ error: 'File content does not match allowed image formats' }, { status: 400 });
    }

    /**
     * Files go into their owner's namespace.
     *
     * `uploadFile` has always accepted a prefix and this — its only call site —
     * never passed one, so every object the platform has ever accepted sits
     * flat at the bucket root with no slash in its path. That made the deletion
     * guard in `deleteFile` a no-op: its escape hatch for legacy files is
     * "no slash in the path", which matched everything. The prefix scheme was
     * documented, tested for in `deleteShop`, and never once in effect.
     *
     * Shop-scoped for the buckets a shop owns; user-scoped for avatars, which
     * belong to a person who may have no shop.
     */
    let prefix: string | undefined;
    let shopId: string | null = null;
    if (bucket === 'avatars') {
      prefix = storagePrefixForUser(session.user.id as string);
    } else {
      const shop = await db.shop.findUnique({
        where: { ownerId: session.user.id as string },
        select: { id: true },
      });
      if (!shop) {
        // Product, logo and banner uploads belong to a storefront. Accepting
        // them from an account without one left files nobody could attribute,
        // and let any signed-in buyer fill the bucket 20 times an hour.
        return NextResponse.json(
          { error: 'Create your store before uploading store images.' },
          { status: 403 }
        );
      }
      prefix = storagePrefixForShop(shop.id);
      shopId = shop.id;
    }

    const publicUrl = await uploadFile(file, bucket, prefix);

    /**
     * Record it, so an abandoned upload can be found again.
     *
     * Without a row there is nothing to look for: the object has no owner in
     * its path history, nothing references it, and no sweep can tell it from a
     * file that is simply not in use yet. Written after the upload succeeds —
     * a row for a file that does not exist would have the sweep chasing
     * nothing.
     *
     * Best-effort: an upload that succeeded must not be reported as failed
     * because bookkeeping did. The cost of losing a row is one orphan.
     */
    try {
      const path = storagePathFromUrl(publicUrl, bucket);
      /**
       * No path means the URL is not ours.
       *
       * In development without Supabase credentials, `uploadFile` returns a
       * placeholder stock photo instead of storing anything — there is no
       * object, so there is nothing to track and nothing for the sweep to
       * reclaim. Recording it would create a row pointing at somebody else's
       * CDN that the nightly job would then try to delete.
       *
       * In production this branch is unreachable: `assertStorageUsable` makes
       * an unconfigured bucket fatal before we get here.
       */
      if (path) {
        await db.upload.create({
          data: {
            userId: session.user.id as string,
            shopId: shopId ?? null,
            bucket,
            url: publicUrl,
            path,
          },
        });
      }
    } catch (err) {
      logger.warn('Upload succeeded but was not recorded', {
        bucket,
        reason: err instanceof Error ? err.message : String(err),
      });
    }

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    // The real error is logged, never returned. Echoing error.message handed
    // clients internal detail — module resolution failures, storage provider
    // messages, stack-adjacent strings — for no user benefit.
    logger.error('File upload controller error', error);
    return NextResponse.json(
      { error: 'Upload failed. Please try again, or use a different image.' },
      { status: 500 }
    );
  }
}
