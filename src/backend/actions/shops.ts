'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { deleteFile, storagePrefixForShop } from '@/lib/supabase';
import { ShopSchema } from '@/lib/zod-schemas';
import { rateLimit, RATE_LIMITS } from '../lib/rate-limit';
import { Role } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { logger } from '../lib/logger';
import { revalidateMarketplace, revalidateShopSurface } from '@/shared/lib/cache';
import { toUserMessage, CONFLICT_ERROR } from '../lib/action-errors';
import { SUSPENDED_MESSAGE } from '@/shared/lib/suspension';
import { normaliseWhatsapp } from '@/shared/lib/whatsapp-number';
import { slugClashReason, slugClashReasonForNewShop, retireSlug } from '../lib/shop-slug';
import { roleAfterShopRemoval } from '@/shared/lib/shop-removal';

const IdParamSchema = z.string().cuid('Invalid identifier format');


export async function createShop(rawData: unknown) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return { error: 'You must be logged in to create a shop' };
    }

    const userId = session.user.id;

    const rl = await rateLimit(`shop-create:${userId}`, RATE_LIMITS.SHOP_CREATE.limit, RATE_LIMITS.SHOP_CREATE.windowMs);
    if (!rl.success) {
      return { error: 'Too many shop creation attempts today. Please try again later.' };
    }

    // Check if user already owns a shop
    const existingShop = await db.shop.findUnique({
      where: { ownerId: userId },
    });

    if (existingShop) {
      return { error: 'You already own a storefront on this platform' };
    }

    // Validate inputs
    const validated = ShopSchema.safeParse(rawData);
    if (!validated.success) {
      return { error: validated.error.issues[0].message };
    }

    // Live shops *and* retired addresses. A brand-new store taking a slug that
    // another store used to own would inherit its traffic on day one.
    const clash = await slugClashReasonForNewShop(validated.data.slug);
    if (clash) return { error: clash };

    // Create the shop and upgrade user's role to SELLER
    const shop = await db.$transaction(async (tx) => {
      const newShop = await tx.shop.create({
        data: {
          ownerId: userId,
          name: validated.data.name,
          slug: validated.data.slug,
          description: validated.data.description || null,
          logo: validated.data.logo || null,
          banner: validated.data.banner || null,
          whatsapp: validated.data.whatsapp,
          instagram: validated.data.instagram || null,
          telegram: validated.data.telegram || null,
          city: validated.data.city || null,
          region: validated.data.region || null,
          deliveryNote: validated.data.deliveryNote || null,
          isVerified: false,
        },
      });

      /**
       * Promote a buyer, never demote an admin.
       *
       * This was unconditional, so an admin opening a test store silently
       * dropped to SELLER — and `requireAdmin()` reads the role from the
       * database, so they lost /admin immediately and could not restore it,
       * because restoring roles requires being an admin.
       */
      const current = await tx.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (current?.role === Role.USER) {
        await tx.user.update({
          where: { id: userId },
          data: { role: Role.SELLER },
        });
      }

      return newShop;
    });

    revalidatePath('/');
    revalidateMarketplace();
    revalidatePath('/dashboard');
    return { success: true, shop };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'createShop' }) };
  }
}

export async function updateShop(shopId: string, rawData: unknown) {
  try {
    const parsedShopId = IdParamSchema.safeParse(shopId);
    if (!parsedShopId.success) {
      return { error: 'Invalid shop ID format' };
    }

    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return { error: 'Unauthorized' };
    }

    const existingShop = await db.shop.findUnique({
      where: { id: parsedShopId.data },
    });

    if (!existingShop) {
      return { error: 'Storefront not found' };
    }

    /**
     * Owner only. Deliberately not "owner or admin".
     *
     * This used to fall through for anyone whose JWT claimed ADMIN, which was
     * a claim the client could write. But the deeper problem outlived that bug:
     * admins already have `repairStoreAction`, which demands a written reason,
     * writes slug history and records an audit row. This path demanded none of
     * those. Two doors into the same privileged operation, one of them unlogged,
     * is worse than one door — so this one is now the owner's alone.
     */
    if (existingShop.ownerId !== session.user.id) {
      return { error: 'You do not have permission to manage this store' };
    }

    /**
     * A suspended seller cannot keep working.
     *
     * Suspension used to be enforced at read time only — the buyer saw a
     * suspended page while the seller carried on renaming the store, changing
     * the WhatsApp number and adding products. Everything they built during a
     * ban went live the moment it lifted.
     *
     * Deliberately not extended to `isUnderReview`: that state must stay
     * invisible to its subject, so refusing writes on it would announce it.
     */
    if (existingShop.isSuspended) {
      return { error: SUSPENDED_MESSAGE };
    }

    const validated = ShopSchema.safeParse(rawData);
    if (!validated.success) {
      return { error: validated.error.issues[0].message };
    }

    // Optimistic concurrency: refuse the write if the row moved since the
    // client read it, rather than silently overwriting the other editor.
    if (validated.data.expectedUpdatedAt) {
      const expected = new Date(validated.data.expectedUpdatedAt);
      if (
        !Number.isNaN(expected.getTime()) &&
        existingShop.updatedAt.getTime() !== expected.getTime()
      ) {
        return { error: CONFLICT_ERROR, conflict: true as const };
      }
    }

    const slugChanged = validated.data.slug !== existingShop.slug;

    if (slugChanged) {
      const clash = await slugClashReason(validated.data.slug, existingShop.id);
      if (clash) return { error: clash };

      // A legitimate seller renames once, maybe twice, ever. Anyone doing it
      // repeatedly is hunting for handles — and every change retires an address
      // permanently, so the cost of a loop is paid by everyone.
      const rl = await rateLimit(
        `shop-slug-change:${session.user.id}`,
        RATE_LIMITS.SHOP_SLUG_CHANGE.limit,
        RATE_LIMITS.SHOP_SLUG_CHANGE.windowMs
      );
      if (!rl.success) {
        return {
          error:
            'You have changed your store address several times recently. ' +
            'Each change retires the old one permanently, so this is limited — try again later.',
        };
      }
    }

    const rlSave = await rateLimit(
      `shop-update:${session.user.id}`,
      RATE_LIMITS.SHOP_UPDATE.limit,
      RATE_LIMITS.SHOP_UPDATE.windowMs
    );
    if (!rlSave.success) {
      return { error: 'Too many changes in a short time. Please try again in a few minutes.' };
    }

    /**
     * Compare normalised to normalised.
     *
     * `ShopSchema` preprocesses the number — a bare `919700000001` becomes
     * `+919700000001` — so comparing the parsed value against the stored one
     * reported a change on every save of any shop whose stored number predates
     * that normalisation. The seller edits their city, and their store silently
     * leaves the marketplace. Found by saving a form in a browser; no unit test
     * would have shown it, because the fixtures are already normalised.
     */
    const whatsappChanged = validated.data.whatsapp !== normaliseWhatsapp(existingShop.whatsapp);

    const updatedShop = await db.$transaction(async (tx) => {
      /**
       * Keep the old address alive.
       *
       * Without this, renaming broke every link the seller had ever shared —
       * silently, with no error, and irrecoverably once another store claimed
       * the slug. The admin repair path has always done this; the seller's own
       * rename, reachable from a plain text input, did not.
       */
      if (slugChanged) {
        await retireSlug(tx, existingShop.id, existingShop.slug, session.user.id ?? null);
      }

      return tx.shop.update({
      where: { id: parsedShopId.data },
      data: {
        name: validated.data.name,
        slug: validated.data.slug,
        description: validated.data.description || null,
        logo: validated.data.logo || null,
        banner: validated.data.banner || null,
        whatsapp: validated.data.whatsapp,
        // A changed number is an unverified number, and an unverified number
        // must not stay in discovery. `DISCOVERABLE_SHOP` now enforces that on
        // read as well, but leaving `isListed` true would still show the seller
        // a "listed" state they no longer have.
        whatsappVerifiedAt: whatsappChanged ? null : existingShop.whatsappVerifiedAt,
        whatsappVerifiedVia: whatsappChanged ? null : existingShop.whatsappVerifiedVia,
        isListed: whatsappChanged ? false : existingShop.isListed,
        instagram: validated.data.instagram || null,
        telegram: validated.data.telegram || null,
        city: validated.data.city || null,
        region: validated.data.region || null,
        deliveryNote: validated.data.deliveryNote || null,
      },
      });
    });

    /**
     * Delete the files this save replaced.
     *
     * `deleteShop` and the product paths both clean up; the edit path did not,
     * so every logo re-upload left a permanently unreferenced object with
     * nothing pointing at it and no way to attribute it later. Best-effort and
     * after the commit, like every other cleanup here — an orphaned file is a
     * cost, a failed save is a lost afternoon.
     */
    const prefix = storagePrefixForShop(existingShop.id);
    for (const [before, after, bucket] of [
      [existingShop.logo, updatedShop.logo, 'logos'],
      [existingShop.banner, updatedShop.banner, 'banners'],
    ] as const) {
      if (before && before !== after) {
        try {
          await deleteFile(before, bucket, prefix);
        } catch {
          // Never block a successful save on storage.
        }
      }
    }

    revalidateShopSurface(existingShop.slug);
    revalidateShopSurface(updatedShop.slug);
    revalidatePath('/dashboard');
    revalidateMarketplace();
    return {
      success: true as const,
      shop: updatedShop,
      /**
       * Said out loud, because the consequence is invisible otherwise: the
       * store quietly leaves the marketplace, and no seller expects editing a
       * phone number to do that.
       *
       * A plain field rather than a conditional spread — spreading widens
       * `success` to `boolean` and the union stops narrowing at every call site.
       */
      notice: whatsappChanged
        ? 'Your new WhatsApp number needs verifying. Until then your store is hidden from ' +
          'the marketplace and search — your direct link keeps working.'
        : undefined,
    };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'updateShop', shopId }) };
  }
}

export async function deleteShop() {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return { error: 'Unauthorized' };
    }

    const shop = await db.shop.findUnique({
      where: { ownerId: session.user.id },
      include: {
        products: {
          include: { images: { select: { url: true } } },
        },
      },
    });

    if (!shop) {
      return { error: 'You do not own a storefront' };
    }

    const imageUrls = shop.products.flatMap((p) => p.images.map((img) => img.url));

    await db.$transaction(async (tx) => {
      await tx.shop.delete({ where: { id: shop.id } });
      /**
       * Hand back the buyer role — but only from SELLER.
       *
       * `roleAfterShopRemoval` exists for exactly this, has unit tests
       * asserting an admin is left alone, and was used by the admin deletion
       * path but not by the seller's own. So an admin who owned a storefront
       * demoted themselves permanently by deleting it.
       */
      const owner = await tx.user.findUnique({
        where: { id: session.user.id as string },
        select: { role: true },
      });
      const nextRole = owner ? roleAfterShopRemoval(owner.role) : null;
      if (nextRole) {
        await tx.user.update({
          where: { id: session.user.id as string },
          data: { role: nextRole },
        });
      }
    });

    // Storage cleanup only after the database delete has committed. Doing it
    // first meant a failed transaction left a live shop with dead image URLs.
    const prefix = storagePrefixForShop(shop.id);
    for (const url of imageUrls) {
      try {
        await deleteFile(url, 'products', prefix);
      } catch {
        // Orphaned files are acceptable; never block deletion on storage
      }
    }
    if (shop.logo) {
      try { await deleteFile(shop.logo, 'logos', prefix); } catch { /* best-effort */ }
    }
    if (shop.banner) {
      try { await deleteFile(shop.banner, 'banners', prefix); } catch { /* best-effort */ }
    }

    revalidateShopSurface(shop.slug);
    revalidateMarketplace();
    revalidatePath('/sell');
    revalidatePath('/dashboard');

    logger.info('Storefront deleted by owner', { shopId: shop.id, slug: shop.slug });
    return { success: true };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'deleteShop' }) };
  }
}

export async function toggleShopPause(isPaused: boolean) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return { error: 'Unauthorized' };
    }

    const shop = await db.shop.findUnique({
      where: { ownerId: session.user.id },
      select: { id: true, slug: true, isSuspended: true },
    });

    if (!shop) {
      return { error: 'You do not own a storefront' };
    }

    // Un-pausing a suspended store would otherwise look like it worked.
    if (shop.isSuspended) {
      return { error: SUSPENDED_MESSAGE };
    }

    const updated = await db.shop.update({
      where: { id: shop.id },
      data: { isPaused: Boolean(isPaused) },
    });

    revalidateShopSurface(shop.slug);
    revalidatePath('/dashboard');
    return { success: true, isPaused: updated.isPaused };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'toggleShopPause' }) };
  }
}

