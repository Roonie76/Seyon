'use server';

import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { deleteFile, storagePrefixForShop, storagePrefixForUser } from '@/lib/supabase';
import { logger } from '../lib/logger';
import { toUserMessage } from '../lib/action-errors';

/**
 * Taking back an upload the seller changed their mind about.
 *
 * Removing an image from the product form cleared React state and nothing
 * else, so the file stayed in the bucket for good. This is the other half of
 * that button: the file is deleted immediately if it is still the uploader's
 * and nothing durable references it.
 *
 * Scoped to the caller's own uploads by construction — the row is looked up by
 * url *and* userId together, so a URL belonging to somebody else simply is not
 * found. That matters more than usual here, because the argument is a public
 * URL that anyone could have read off a page.
 */

const UrlSchema = z.string().url('Invalid image reference').max(2048);

export async function discardUpload(
  rawUrl: unknown
): Promise<{ success: true; error?: undefined } | { error: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { error: 'You must be signed in.' };

    const parsed = UrlSchema.safeParse(rawUrl);
    if (!parsed.success) return { error: parsed.error.issues[0].message };

    const upload = await db.upload.findFirst({
      where: { url: parsed.data, userId: session.user.id, deletedAt: null },
    });
    // Not an error: an image the seller pasted rather than uploaded has no row,
    // and removing it from the form is still the right outcome.
    if (!upload) return { success: true };

    /**
     * Refuse if anything already points at it.
     *
     * A seller can remove an image from one product while a duplicate of that
     * product still uses it. The form only knows about the product in front of
     * it; the database knows about all of them.
     */
    const referenced = await db.productImage.findFirst({
      where: { url: parsed.data },
      select: { id: true },
    });
    if (referenced) {
      await db.upload.update({
        where: { id: upload.id },
        data: { attachedAt: upload.attachedAt ?? new Date() },
      });
      return { success: true };
    }

    const prefix = upload.shopId
      ? storagePrefixForShop(upload.shopId)
      : storagePrefixForUser(upload.userId);

    try {
      await deleteFile(upload.url, upload.bucket as 'logos' | 'banners' | 'products' | 'avatars', prefix);
    } catch (err) {
      // The row is still marked deleted: the sweep would only retry a delete
      // that has already failed once, and an orphan is cheaper than a loop.
      logger.warn('Could not delete a discarded upload', {
        uploadId: upload.id,
        reason: err instanceof Error ? err.message : String(err),
      });
    }

    await db.upload.update({ where: { id: upload.id }, data: { deletedAt: new Date() } });
    return { success: true };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'discardUpload' }) };
  }
}

/**
 * Mark uploads as in use once they are saved onto something.
 *
 * Called by the product write paths after a successful commit. An unattached
 * row is what the nightly sweep deletes, so failing to call this would delete
 * live images — which is why it is deliberately forgiving in the other
 * direction: a URL with no row, or one already attached, is a no-op.
 */
export async function markUploadsAttached(urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  try {
    await db.upload.updateMany({
      where: { url: { in: urls }, attachedAt: null },
      data: { attachedAt: new Date() },
    });
  } catch (err) {
    logger.warn('Could not mark uploads as attached', {
      count: urls.length,
      reason: err instanceof Error ? err.message : String(err),
    });
  }
}
