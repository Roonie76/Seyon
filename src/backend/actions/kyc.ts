'use server';

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { KycStatus, KycTier, KycIdType } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { logger } from '../lib/logger';
import { toUserMessage } from '../lib/action-errors';
import { rateLimit, RATE_LIMITS } from '../lib/rate-limit';
import { verifyIdentifier } from '../lib/kyc-provider';
import { checkPan, checkGstin, normalisePan, normaliseGstin, lastFour } from '@/shared/lib/kyc';
import { SELLER_UNDERTAKING_VERSION } from '@/shared/data/seller-undertaking';
import { revalidateMarketplace, revalidateShopSurface } from '@/shared/lib/cache';

/**
 * Seller identity.
 *
 * Tier 0 costs a seller two minutes and no documents: legal name, address,
 * a verified WhatsApp number, and the undertaking. Completing it is what makes
 * their store discoverable. They can build the whole storefront first and look
 * at it by direct link — the gate is on being *found*, not on existing, because
 * a document wall in front of someone who has not yet seen the product working
 * is how you lose them.
 *
 * Tier 1 is the verified badge and is reviewed by a person.
 *
 * What is never stored: the full PAN or other identifier. Only the last four
 * characters, so a seller recognises which document is on file, and a salted
 * hash, so one PAN opening five stores under five accounts is detectable.
 */

const TIER0 = z.object({
  legalName: z
    .string()
    .trim()
    .min(3, 'Enter your full legal name as it appears on your ID.')
    .max(120, 'That name is too long.'),
  addressLine1: z.string().trim().min(5, 'Enter your street address.').max(160),
  addressLine2: z.string().trim().max(160).optional().or(z.literal('')),
  city: z.string().trim().min(2, 'Enter your city.').max(80),
  state: z.string().trim().min(2, 'Enter your state.').max(80),
  postalCode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, 'Enter a valid 6-digit Indian PIN code.'),
  acceptedUndertaking: z.literal(true, {
    message: 'You must accept the seller undertaking before your store can be listed.',
  }),
});

const TIER1 = z.object({
  idType: z.enum(['PAN', 'PASSPORT', 'DRIVING_LICENCE', 'VOTER_ID', 'AADHAAR_MASKED']),
  idNumber: z.string().trim().min(4, 'Enter the number on your document.').max(40),
  gstin: z.string().trim().optional().or(z.literal('')),
});

/**
 * Salt the hash. An unsalted hash of a 10-character PAN is trivially reversed by
 * enumeration — the whole keyspace is small enough to precompute. The salt lives
 * in the environment, not the database, so a dump of the table alone does not
 * let anyone recover which PANs are on file.
 */
function hashIdentifier(value: string): string {
  const salt = process.env.AUTH_SECRET ?? '';
  return createHash('sha256').update(`${salt}:${value.toUpperCase()}`).digest('hex');
}

export interface KycView {
  tier: KycTier;
  status: KycStatus;
  legalName: string | null;
  idType: KycIdType | null;
  idLast4: string | null;
  gstin: string | null;
  rejectionReason: string | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  undertakingAt: Date | null;
  /** Everything Tier 0 needs, and whether it is done. */
  tier0Complete: boolean;
  whatsappVerified: boolean;
  isListed: boolean;
  hasShop: boolean;
}

/** Current identity state for the signed-in seller. */
export async function getMyKyc(): Promise<{ data: KycView } | { error: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { error: 'You must be signed in.' };

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      include: { sellerKyc: true, shop: { select: { isListed: true, whatsappVerifiedAt: true } } },
    });
    if (!user) return { error: 'Account not found.' };

    const kyc = user.sellerKyc;
    const whatsappVerified = Boolean(user.shop?.whatsappVerifiedAt);
    const tier0Complete =
      Boolean(kyc?.undertakingAt) &&
      Boolean(kyc?.legalName) &&
      Boolean(user.addressLine1 && user.city && user.state && user.postalCode) &&
      whatsappVerified;

    return {
      data: {
        tier: kyc?.tier ?? KycTier.TIER_0,
        status: kyc?.status ?? KycStatus.NOT_STARTED,
        legalName: kyc?.legalName ?? null,
        idType: kyc?.idType ?? null,
        idLast4: kyc?.idLast4 ?? null,
        gstin: kyc?.gstin ?? null,
        rejectionReason: kyc?.rejectionReason ?? null,
        submittedAt: kyc?.submittedAt ?? null,
        reviewedAt: kyc?.reviewedAt ?? null,
        undertakingAt: kyc?.undertakingAt ?? null,
        tier0Complete,
        whatsappVerified,
        isListed: user.shop?.isListed ?? false,
        hasShop: Boolean(user.shop),
      },
    };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'getMyKyc' }) };
  }
}

/**
 * Complete Tier 0 and list the store.
 *
 * Address goes on `User` where the existing profile fields already live, rather
 * than being duplicated onto the KYC record. One address, one place to correct.
 */
export async function submitTier0(
  rawData: unknown
): Promise<{ success: true; listed: boolean; error?: undefined } | { error: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { error: 'You must be signed in.' };
    const userId = session.user.id;

    const parsed = TIER0.safeParse(rawData);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Please check the form and try again.' };
    }
    const d = parsed.data;

    const shop = await db.shop.findUnique({
      where: { ownerId: userId },
      select: { id: true, slug: true, whatsappVerifiedAt: true },
    });
    if (!shop) {
      return { error: 'Create your store first, then complete verification.' };
    }

    // The WhatsApp number is the only contact a buyer gets. Listing a store
    // whose number was never confirmed puts an unreachable seller into
    // discovery, which is worse for the buyer than the store not being there.
    if (!shop.whatsappVerifiedAt) {
      return {
        error: 'Verify your WhatsApp number first — buyers reach you there, so it has to work.',
      };
    }

    const listedAt = new Date();

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          addressLine1: d.addressLine1,
          addressLine2: d.addressLine2 || null,
          city: d.city,
          state: d.state,
          postalCode: d.postalCode,
          country: 'India',
        },
      });

      await tx.sellerKyc.upsert({
        where: { userId },
        create: {
          userId,
          tier: KycTier.TIER_0,
          status: KycStatus.NOT_STARTED,
          legalName: d.legalName,
          undertakingAt: listedAt,
          undertakingVersion: SELLER_UNDERTAKING_VERSION,
        },
        update: {
          legalName: d.legalName,
          undertakingAt: listedAt,
          undertakingVersion: SELLER_UNDERTAKING_VERSION,
        },
      });

      await tx.shop.update({ where: { id: shop.id }, data: { isListed: true } });
    });

    logger.info('Tier 0 identity completed, store listed', { shopId: shop.id });

    revalidateShopSurface(shop.slug);
    revalidateMarketplace();
    revalidatePath('/dashboard');

    return { success: true, listed: true };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'submitTier0' }) };
  }
}

/**
 * Submit Tier 1 for human review.
 *
 * The identifier is validated locally, offered to whatever provider is
 * configured, and then stored as last-four plus hash. The raw value never
 * reaches a column.
 */
export async function submitTier1(
  rawData: unknown
): Promise<{ success: true; status: KycStatus; error?: undefined } | { error: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { error: 'You must be signed in.' };
    const userId = session.user.id;

    const rl = await rateLimit(
      `kyc-submit:${userId}`,
      RATE_LIMITS.KYC_SUBMIT.limit,
      RATE_LIMITS.KYC_SUBMIT.windowMs
    );
    if (!rl.success) {
      return { error: 'You have submitted this several times already. Please wait before trying again.' };
    }

    const parsed = TIER1.safeParse(rawData);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Please check the form and try again.' };
    }
    const d = parsed.data;

    const existing = await db.sellerKyc.findUnique({ where: { userId } });
    if (!existing?.undertakingAt) {
      return { error: 'Complete the basic details and the seller undertaking first.' };
    }
    if (existing.status === KycStatus.PENDING_REVIEW) {
      return { error: 'Your documents are already with our team. We will come back to you.' };
    }
    if (existing.status === KycStatus.APPROVED) {
      return { error: 'Your identity is already verified.' };
    }

    // Aadhaar is accepted only in masked form. Storing a full Aadhaar number is
    // restricted under the Aadhaar Act, and this is where that rule is enforced
    // rather than left to the form to remember.
    const raw = d.idNumber.trim();
    if (d.idType === 'AADHAAR_MASKED' && /^\d{12}$/.test(raw.replace(/\s/g, ''))) {
      return {
        error:
          'Please do not enter a full Aadhaar number. Use the masked form showing only the last four digits, or choose PAN instead.',
      };
    }

    if (d.idType === 'PAN') {
      const check = checkPan(raw);
      if (!check.valid) return { error: check.error ?? 'That PAN is not valid.' };
    }

    let gstin: string | null = null;
    if (d.gstin) {
      const g = checkGstin(d.gstin);
      if (!g.valid) return { error: g.error ?? 'That GSTIN is not valid.' };
      gstin = normaliseGstin(d.gstin);
    }

    const normalised = d.idType === 'PAN' ? normalisePan(raw) : raw.toUpperCase();
    const idHash = hashIdentifier(normalised);

    // One identifier, one seller. Catching this here is cheaper than a reviewer
    // noticing the same PAN across five accounts weeks later.
    const clash = await db.sellerKyc.findFirst({
      where: { idHash, userId: { not: userId } },
      select: { id: true },
    });
    if (clash) {
      return {
        error:
          'That document is already registered to another Seyon account. If you believe this is wrong, contact support.',
      };
    }

    const outcome = await verifyIdentifier(
      d.idType === 'PAN' ? 'PAN' : 'GSTIN',
      normalised,
      existing.legalName ?? ''
    );
    if (outcome.result === 'mismatch') {
      return {
        error: 'The name on that document does not match the legal name on your account.',
      };
    }

    await db.sellerKyc.update({
      where: { userId },
      data: {
        idType: d.idType as KycIdType,
        idLast4: lastFour(normalised),
        idHash,
        gstin,
        status: KycStatus.PENDING_REVIEW,
        submittedAt: new Date(),
        rejectionReason: null,
        reviewedAt: null,
        reviewedById: null,
      },
    });

    logger.info('Tier 1 identity submitted for review', {
      idType: d.idType,
      providerOutcome: outcome.result,
    });

    revalidatePath('/dashboard');
    return { success: true, status: KycStatus.PENDING_REVIEW };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'submitTier1' }) };
  }
}
