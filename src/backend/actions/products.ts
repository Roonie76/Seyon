'use server';

import { auth } from '@/lib/auth';
import { normaliseProductImages } from '@/shared/lib/product-images';
import { SUSPENDED_MESSAGE } from '@/shared/lib/suspension';
import { isOwnedStorageUrl } from '@/lib/supabase';
import { db } from '@/lib/db';
import { isCurrentUserAdmin } from '../lib/is-admin';
import { ProductSchema, ReorderImagesSchema } from '@/lib/zod-schemas';
import { rateLimit, RATE_LIMITS } from '../lib/rate-limit';
import { revalidatePath } from 'next/cache';
import { deleteFile, storagePrefixForShop } from '@/lib/supabase';
import { z } from 'zod';
import { logger } from '../lib/logger';
import { revalidateShopSurface } from '@/shared/lib/cache';
import { extractDominantColor } from '../lib/color/extractDominant';
import { generateTheme } from '../lib/color/generateTheme';
import { slugify } from '@/shared/lib/slugify';
import { safeFetchImage } from '../lib/safe-image-fetch';
import { isAllowedImageUrl, IMAGE_URL_ERROR } from '@/shared/lib/image-hosts';
import { toUserMessage, isUniqueViolation, CONFLICT_ERROR } from '../lib/action-errors';

const IdParamSchema = z.string().cuid('Invalid identifier format');

/**
 * Pick a slug that is free within the shop.
 *
 * This is still check-then-insert, so it stays a race — the difference is that
 * the caller now retries on the unique-constraint violation instead of handing
 * the loser a raw Prisma exception. `excludeId` keeps a product from colliding
 * with itself on rename.
 */
async function allocateSlug(
  shopId: string,
  title: string,
  excludeId?: string,
  attempt = 0
): Promise<string> {
  const base = slugify(title);
  const candidates: string[] = [base];
  for (let i = 1; i <= 50; i++) candidates.push(`${base}-${i}`);

  const taken = await db.product.findMany({
    where: {
      shopId,
      slug: { in: candidates },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { slug: true },
  });
  const used = new Set(taken.map((p) => p.slug));

  const free = candidates.find((c) => !used.has(c));
  if (free) {
    // On a retry, jump past the contended range rather than fighting for it.
    return attempt === 0 ? free : `${base}-${Date.now().toString(36)}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * Run a write that carries a generated slug, retrying once on the unique
 * violation two concurrent saves can produce. Without this, whichever request
 * loses the race gets a raw Prisma error.
 */
async function withSlugRetry<T>(
  write: (slug: string) => Promise<T>,
  shopId: string,
  title: string,
  excludeId?: string
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = await allocateSlug(shopId, title, excludeId, attempt);
    try {
      return await write(slug);
    } catch (err) {
      if (attempt < 2 && isUniqueViolation(err)) continue;
      throw err;
    }
  }
  // Unreachable: the loop either returns or throws.
  throw new Error('Could not allocate a unique product address');
}

/**
 * Delete product image files, but only ones this shop is entitled to remove.
 *
 * Image URLs on a product are seller-supplied, so without this check a seller
 * could attach a competitor's public image URL to their own product, delete
 * the product, and destroy the competitor's file. Two guards:
 *   - the storage path must sit under this shop's prefix (new uploads), and
 *   - no product outside this shop may still reference the URL (legacy files
 *     uploaded before the prefix existed).
 */
async function deleteOwnedFiles(urls: string[], shopId: string): Promise<void> {
  if (urls.length === 0) return;

  const referencedElsewhere = await db.productImage.findMany({
    where: { url: { in: urls }, product: { shopId: { not: shopId } } },
    select: { url: true },
  });
  const blocked = new Set(referencedElsewhere.map((r) => r.url));

  for (const url of urls) {
    if (blocked.has(url)) {
      logger.warn('Skipped deleting an image referenced by another shop', { url, shopId });
      continue;
    }
    try {
      await deleteFile(url, 'products', storagePrefixForShop(shopId));
    } catch (err) {
      // Storage cleanup is best-effort; an orphaned file is not worth failing
      // an otherwise successful save.
      logger.warn('Storage cleanup failed', {
        url,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/**
 * Derive the storefront theme from a product image.
 *
 * Decoration only — it must never be able to fail or stall a save. The fetch
 * is host-restricted, deadline-bound and size-capped (see safeFetchImage); a
 * malformed image previously held this action open for 115 seconds and threw
 * an unhandled rejection out of node-vibrant's internal stream.
 */
async function extractTheme(url: string): Promise<ReturnType<typeof generateTheme> | null> {
  try {
    const buffer = await safeFetchImage(url);
    if (!buffer) return null;
    const dominantColor = await extractDominantColor(buffer);
    return dominantColor ? generateTheme(dominantColor) : null;
  } catch (err) {
    logger.warn('Colour theme extraction failed; continuing without a theme', {
      url,
      reason: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function verifyShopOwnership(shopId: string) {
  const parsedShopId = IdParamSchema.safeParse(shopId);
  if (!parsedShopId.success) {
    throw new Error('Invalid shop ID format');
  }

  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    throw new Error('Unauthenticated');
  }

  const shop = await db.shop.findUnique({
    where: { id: parsedShopId.data },
  });

  if (!shop) {
    throw new Error('Shop not found');
  }

  // Role from the database, not from the token. The JWT claim was client
  // -writable through the session-update endpoint until that branch was removed,
  // and a stale claim outlives a revoked admin either way.
  if (shop.ownerId !== session.user.id && !(await isCurrentUserAdmin())) {
    throw new Error('Unauthorized store management');
  }

  return { session, shop };
}

/**
 * Ownership, plus the store actually being allowed to trade.
 *
 * `verifyShopOwnership` checks who you are and stops there, which is right for
 * a delete — a suspended seller taking down their own listing is a good
 * outcome — and wrong for anything that adds or publishes. Suspension used to
 * be enforced only when a buyer read the page, so a seller banned for selling
 * counterfeits kept uploading all day and everything went live at once when the
 * ban lifted.
 *
 * Not extended to `isUnderReview` on purpose: that state has to stay invisible
 * to the seller, and refusing their writes would tell them about it.
 */
async function verifyShopWritable(shopId: string) {
  const result = await verifyShopOwnership(shopId);
  if (result.shop.isSuspended) {
    throw new Error(SUSPENDED_MESSAGE);
  }
  return result;
}

/**
 * Refuse images that live in another shop's storage namespace.
 *
 * `ProductImageSchema` checks the URL's host against an allowlist, which lets a
 * competitor's `*.supabase.co` product photo through. Attaching one displayed
 * it as your own, and — because `deleteOwnedFiles` will not delete a file
 * another shop references — left the original owner unable to remove it.
 *
 * External hosts (Unsplash and friends) are not our storage and are not our
 * business here; this only checks objects in our own buckets.
 */
function foreignImageError(images: { url: string }[], shopId: string): string | null {
  const prefix = storagePrefixForShop(shopId);
  const foreign = images.find((img) => !isOwnedStorageUrl(img.url, 'products', prefix));
  return foreign
    ? 'One of those images belongs to another store. Upload your own copy instead.'
    : null;
}

export async function createProduct(shopId: string, rawData: unknown) {
  try {
    const parsedShopId = IdParamSchema.safeParse(shopId);
    if (!parsedShopId.success) {
      return { error: 'Invalid shop ID format' };
    }

    const { shop } = await verifyShopWritable(parsedShopId.data);

    const rl = await rateLimit(`product-create:${shop.ownerId}`, RATE_LIMITS.PRODUCT_CREATE.limit, RATE_LIMITS.PRODUCT_CREATE.windowMs);
    if (!rl.success) {
      return { error: 'Too many products created today. Please try again later.' };
    }

    const validated = ProductSchema.safeParse(rawData);
    if (!validated.success) {
      return { error: validated.error.issues[0].message };
    }

    const { title, description, price, compareAtPrice, category, options, inStock, status, images } = validated.data;

    const foreign = foreignImageError(images ?? [], parsedShopId.data);
    if (foreign) return { error: foreign };

    const normalisedImages = normaliseProductImages(images ?? []);
    // The theme is sampled from the cover, so a seller who picks a different
    // primary gets colours drawn from the photo buyers actually see.
    const theme = normalisedImages.length > 0 ? await extractTheme(normalisedImages[0].url) : null;

    const discountPercent =
      compareAtPrice && compareAtPrice > price
        ? (compareAtPrice - price) / compareAtPrice
        : null;

    const product = await withSlugRetry((finalSlug) =>
      db.product.create({
      data: {
        shopId: parsedShopId.data,
        title,
        slug: finalSlug,
        description,
        price,
        compareAtPrice: compareAtPrice ?? null,
        discountPercent,
        category,
        options: options || null,
        inStock,
        status,
        // Records the moment the listing first became public, which is when the
        // slug freezes. Null for a draft, which is still free to be renamed.
        firstActivatedAt: status === 'ACTIVE' ? new Date() : null,
        images: {
          // Normalised rather than taken as given: the chosen cover moves to
          // displayOrder 0, which is what every public card query reads.
          create: normalisedImages,
        },
        themeBg: theme?.bg || null,
        themeSurface: theme?.surface || null,
        themeAccent: theme?.accent || null,
        themeAccentStrong: theme?.accentStrong || null,
        themeText: theme?.text || null,
        themeMuted: theme?.muted || null,
        themeExtractedAt: theme ? new Date() : null,
      },
      include: {
        images: true,
      },
      })
    , parsedShopId.data, title);

    revalidateShopSurface(shop.slug, product.slug, product.category);
    revalidatePath('/dashboard/products');
    return { success: true, product };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'createProduct', shopId }) };
  }
}

export async function updateProduct(productId: string, rawData: unknown) {
  try {
    const parsedProductId = IdParamSchema.safeParse(productId);
    if (!parsedProductId.success) {
      return { error: 'Invalid product ID format' };
    }

    const product = await db.product.findUnique({
      where: { id: parsedProductId.data },
      include: { images: true },
    });

    if (!product) {
      return { error: 'Product not found' };
    }

    // Authenticate and verify owner permission for the shop that owns the product
    const { shop } = await verifyShopWritable(product.shopId);

    const validated = ProductSchema.safeParse(rawData);
    if (!validated.success) {
      return { error: validated.error.issues[0].message };
    }

    const { title, description, price, compareAtPrice, category, options, inStock, status, images, expectedUpdatedAt } = validated.data;

    // Optimistic concurrency. When the client tells us which version it was
    // editing, refuse the write if the row moved underneath it — otherwise two
    // tabs saving different fields silently overwrite each other and both are
    // told it worked.
    if (expectedUpdatedAt) {
      const expected = new Date(expectedUpdatedAt);
      if (!Number.isNaN(expected.getTime()) && product.updatedAt.getTime() !== expected.getTime()) {
        return { error: CONFLICT_ERROR, conflict: true as const };
      }
    }

    const foreign = foreignImageError(images ?? [], product.shopId);
    if (foreign) return { error: foreign };

    // Determine if we need to re-extract theme
    let themeUpdate: {
      themeBg?: string | null;
      themeSurface?: string | null;
      themeAccent?: string | null;
      themeAccentStrong?: string | null;
      themeText?: string | null;
      themeMuted?: string | null;
      themeExtractedAt?: Date | null;
    } = {};
    const newPrimaryUrl = images.find((img: { isPrimary: boolean }) => img.isPrimary)?.url || images[0]?.url;
    const oldPrimaryUrl = product.images.find((img: { isPrimary: boolean }) => img.isPrimary)?.url || product.images[0]?.url;

    if (newPrimaryUrl && (newPrimaryUrl !== oldPrimaryUrl || !product.themeExtractedAt)) {
      const theme = await extractTheme(newPrimaryUrl);
      if (theme) {
        themeUpdate = {
          themeBg: theme.bg,
          themeSurface: theme.surface,
          themeAccent: theme.accent,
          themeAccentStrong: theme.accentStrong,
          themeText: theme.text,
          themeMuted: theme.muted,
          themeExtractedAt: new Date(),
        };
      }
    }

    const discountPercent =
      compareAtPrice && compareAtPrice > price
        ? (compareAtPrice - price) / compareAtPrice
        : null;

    /**
     * The slug is frozen — from first publication, not from creation.
     *
     * Renaming used to rewrite it, which silently broke every link the seller
     * had already shared: WhatsApp messages, QR codes, Instagram bios, search
     * results, with no redirect behind them. Freezing fixed that and introduced
     * a smaller one: Quick Add creates drafts called "Untitled product", so a
     * seller who named and published one was left with
     * /store/<shop>/untitled-product-5 as its address forever.
     *
     * A draft has never been public and has no links to protect. So the freeze
     * starts at the moment the listing first goes ACTIVE, which is the rule it
     * was always reaching for.
     */
    /**
     * `status !== 'ACTIVE'` is part of the test on purpose.
     *
     * `firstActivatedAt` is a new column, so every product that existed before
     * it was added has null in it. Reading null alone as "never published"
     * would regenerate the slug of every live listing on its next edit — the
     * exact link breakage the freeze exists to prevent. A currently-ACTIVE
     * product is published whatever the column says.
     */
    const neverPublished = product.firstActivatedAt === null && product.status !== 'ACTIVE';
    const slug = neverPublished
      ? await allocateSlug(product.shopId, title, product.id)
      : product.slug;
    const firstActivatedAt =
      product.firstActivatedAt ?? (status === 'ACTIVE' ? new Date() : null);

    // Update product inside a database transaction. Storage cleanup happens
    // only AFTER this commits — deleting files first meant a rolled-back
    // transaction left rows pointing at images that no longer existed.
    //
    // `withSlugRetry` is deliberately not wrapped around this: it allocates a
    // slug on every call and threw the result away here, costing a 51-candidate
    // query on every single product edit.
    const updatedProduct = await (async () =>
        db.$transaction(async (tx) => {
          const scalars = {
            title,
            slug,
            firstActivatedAt,
            description,
            price,
            compareAtPrice: compareAtPrice ?? null,
            discountPercent,
            category,
            options: options || null,
            inStock,
            status,
            ...themeUpdate,
          };

          // The version check lives in the WHERE of the write itself, not in a
          // preceding SELECT. Under READ COMMITTED, two concurrent saves both
          // pass a separate SELECT and both then write — which is exactly how
          // one tab's price change disappeared while both were told it saved.
          // updateMany takes the row lock and re-evaluates the predicate
          // against the committed row, so the second writer matches 0 rows.
          const expected = expectedUpdatedAt ? new Date(expectedUpdatedAt) : null;
          const guarded = expected && !Number.isNaN(expected.getTime());

          const res = await tx.product.updateMany({
            where: {
              id: parsedProductId.data,
              ...(guarded ? { updatedAt: expected } : {}),
            },
            data: scalars,
          });

          if (res.count === 0) {
            const stillExists = await tx.product.findUnique({
              where: { id: parsedProductId.data },
              select: { id: true },
            });
            throw new Error(stillExists ? CONFLICT_ERROR : 'Product not found');
          }

          // Images are reconciled by URL rather than deleted and recreated.
          // Wholesale replacement handed every surviving image a new id on
          // every save, so any client holding image ids — the reorder action,
          // most obviously — failed with "Unauthorized image update" after an
          // unrelated edit somewhere else in the form.
          const existing = await tx.productImage.findMany({
            where: { productId: parsedProductId.data },
            select: { id: true, url: true },
          });
          const existingByUrl = new Map(existing.map((img) => [img.url, img.id]));
          const desiredUrls = new Set(images.map((img) => img.url));

          const removedIds = existing
            .filter((img) => !desiredUrls.has(img.url))
            .map((img) => img.id);
          if (removedIds.length > 0) {
            await tx.productImage.deleteMany({ where: { id: { in: removedIds } } });
          }

          for (const img of normaliseProductImages(images)) {
            const { displayOrder, isPrimary } = img;
            const keptId = existingByUrl.get(img.url);
            if (keptId) {
              await tx.productImage.update({
                where: { id: keptId },
                data: { displayOrder, isPrimary },
              });
              // A duplicate of the same URL later in the list must not reuse
              // the id we have just claimed.
              existingByUrl.delete(img.url);
            } else {
              await tx.productImage.create({
                data: { productId: parsedProductId.data, url: img.url, displayOrder, isPrimary },
              });
            }
          }

          const fresh = await tx.product.findUnique({
            where: { id: parsedProductId.data },
            include: { images: true },
          });
          if (!fresh) throw new Error('Product not found');
          return fresh;
        }))();

    // Storage cleanup, post-commit and scoped to files this shop owns.
    const keptUrls = new Set(images.map((img) => img.url));
    const removed = product.images.filter((img) => !keptUrls.has(img.url)).map((img) => img.url);
    await deleteOwnedFiles(removed, product.shopId);

    revalidateShopSurface(shop.slug, product.slug, product.category);
    revalidateShopSurface(shop.slug, updatedProduct.slug, updatedProduct.category);
    revalidatePath('/dashboard/products');
    return { success: true, product: updatedProduct };
  } catch (error) {
    if (error instanceof Error && error.message === CONFLICT_ERROR) {
      return { error: CONFLICT_ERROR, conflict: true as const };
    }
    return { error: toUserMessage(error, { action: 'updateProduct', productId }) };
  }
}

const QuickAddSchema = z
  .array(z.string().refine(isAllowedImageUrl, IMAGE_URL_ERROR))
  .min(1, 'At least one image required')
  .max(12, 'Maximum 12 images per quick-add');

/**
 * Bulk onboarding helper: every uploaded image becomes a DRAFT product the
 * seller then titles and prices. Drafts are invisible to buyers until edited
 * and switched to ACTIVE.
 */
export async function quickAddProducts(shopId: string, rawImageUrls: unknown) {
  try {
    const parsedShopId = IdParamSchema.safeParse(shopId);
    if (!parsedShopId.success) {
      return { error: 'Invalid shop ID format' };
    }

    const { shop } = await verifyShopWritable(parsedShopId.data);

    const validated = QuickAddSchema.safeParse(rawImageUrls);
    if (!validated.success) {
      return { error: validated.error.issues[0].message };
    }

    /**
     * One token per product, not one per call.
     *
     * This charged a single token for a batch of up to twelve, turning the
     * intended 60-products-per-day cap into 720.
     */
    const rl = await rateLimit(
      `product-create:${shop.ownerId}`,
      RATE_LIMITS.PRODUCT_CREATE.limit,
      RATE_LIMITS.PRODUCT_CREATE.windowMs,
      Date.now(),
      { cost: validated.data.length }
    );
    if (!rl.success) {
      return { error: 'Too many products created today. Please try again later.' };
    }

    /**
     * Colour extraction runs concurrently; the inserts stay sequential.
     *
     * Each iteration used to do a remote image fetch with a five-second
     * deadline, then colour extraction, then a slug allocation, then an insert
     * — all serial, so twelve images was a plausible sixty-second server
     * action. The fetches are the slow part and they are independent of each
     * other, so they go together. A fetch that fails yields no theme rather
     * than taking the batch down: the product is still worth creating.
     */
    const themes = await Promise.all(
      validated.data.map((url) =>
        extractTheme(url).catch(() => null)
      )
    );

    const created: string[] = [];
    const failed: string[] = [];
    for (const [i, url] of validated.data.entries()) {
      const theme = themes[i];

      try {
      const product = await withSlugRetry((slug) =>
        db.product.create({
        data: {
          shopId: parsedShopId.data,
          title: 'Untitled product',
          slug,
          description: null,
          price: 0,
          discountPercent: null,
          category: 'Other',
          status: 'DRAFT',
          inStock: true,
          images: {
            create: [{ url, displayOrder: 0, isPrimary: true }],
          },
          themeBg: theme?.bg || null,
          themeSurface: theme?.surface || null,
          themeAccent: theme?.accent || null,
          themeAccentStrong: theme?.accentStrong || null,
          themeText: theme?.text || null,
          themeMuted: theme?.muted || null,
          themeExtractedAt: theme ? new Date() : null,
        },
        select: { id: true },
        }),
        parsedShopId.data,
        'Untitled product'
      );
      created.push(product.id);
      } catch (err) {
        /**
         * A failure partway through used to look like total failure.
         *
         * The catch returned `{ error }`, the client alerted and did not
         * reload, so the seller believed nothing had happened while six
         * untitled drafts sat in their catalogue. Reporting what did land lets
         * the UI say "9 of 12 added" and refresh.
         */
        failed.push(url);
        logger.error('Quick-add failed for one image', err, { shopId: parsedShopId.data, url });
      }
    }

    if (created.length === 0) {
      return { error: 'None of those images could be added. Please try again.' };
    }

    revalidatePath('/dashboard/products');
    return { success: true, count: created.length, failed: failed.length };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'quickAddProducts', shopId }) };
  }
}

export async function toggleProductStock(productId: string, inStock: boolean) {
  try {
    const parsedProductId = IdParamSchema.safeParse(productId);
    if (!parsedProductId.success) {
      return { error: 'Invalid product ID format' };
    }

    const product = await db.product.findUnique({
      where: { id: parsedProductId.data },
      select: { id: true, slug: true, shopId: true },
    });

    if (!product) {
      return { error: 'Product not found' };
    }

    const { shop } = await verifyShopWritable(product.shopId);

    const updated = await db.product.update({
      where: { id: parsedProductId.data },
      data: { inStock: Boolean(inStock) },
    });

    revalidateShopSurface(shop.slug, product.slug, updated.category);
    revalidatePath('/dashboard/products');
    return { success: true, inStock: updated.inStock };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'toggleProductStock', productId }) };
  }
}

export async function deleteProduct(productId: string) {
  try {
    const parsedProductId = IdParamSchema.safeParse(productId);
    if (!parsedProductId.success) {
      return { error: 'Invalid product ID format' };
    }

    const product = await db.product.findUnique({
      where: { id: parsedProductId.data },
      include: { images: true },
    });

    if (!product) {
      return { error: 'Product not found' };
    }

    const { shop } = await verifyShopOwnership(product.shopId);

    // Database first. Storage cleanup afterwards, so a failed delete cannot
    // leave a live product pointing at files that no longer exist.
    await db.product.delete({
      where: { id: parsedProductId.data },
    });

    await deleteOwnedFiles(product.images.map((img) => img.url), product.shopId);

    revalidateShopSurface(shop.slug, product.slug, product.category);
    revalidatePath('/dashboard/products');
    return { success: true };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'deleteProduct', productId }) };
  }
}

/*
 * `reorderProductImages` was removed here.
 *
 * It had no callers anywhere in `src/` or `tests/` — there is no drag-to-
 * reorder UI, which is what left the cover button unable to change anything a
 * buyer sees. But it was still an exported server action, so it was callable,
 * and it validated only that each image id belonged to the product: it did not
 * require the payload to cover the product's whole image set, so one request
 * could leave a product with zero primaries or with several. It also returned
 * success without revalidating anything, so even wired up the storefront would
 * have kept serving the old order.
 *
 * Ordering is now normalised on write in `normaliseProductImages`. If reorder
 * comes back as a feature, it should go through that function too.
 */
