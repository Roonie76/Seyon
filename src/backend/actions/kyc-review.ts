'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { getSession } from '@/backend/lib/session';
import { KycStatus, KycTier, NoticeKind } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { isCurrentUserAdmin } from '../lib/is-admin';
import { logger } from '../lib/logger';
import { toUserMessage } from '../lib/action-errors';
import { signedKycDocumentUrl, deleteKycDocument } from '../lib/kyc-storage';
import { revalidateShopSurface, revalidateMarketplace } from '@/shared/lib/cache';
import { recordAdminAction, recordAdminActionSafe, ADMIN_ACTIONS } from '../lib/admin-audit';
import { issueNotice } from '../lib/notices';

/**
 * Admin side of seller identity.
 *
 * Every function here re-reads the caller's role from the database rather than
 * trusting the JWT claim, for the same reason the rest of the admin surface
 * does: a demoted admin's token stays valid for up to thirty days.
 *
 * Two rules the code enforces rather than trusting a reviewer to remember:
 *
 *  1. A rejection must say why. A seller who is told "rejected" with no reason
 *     cannot fix anything, and support cannot defend the decision later. The
 *     database has a CHECK constraint saying the same thing, so even a direct
 *     SQL update cannot bypass it.
 *  2. The document is deleted once a decision is recorded. Keeping a scan of
 *     someone's PAN after you have finished looking at it is pure liability.
 */

const DecisionSchema = z.object({
  kycId: z.string().cuid('Invalid identifier.'),
  reason: z.string().trim().max(500).optional(),
});

const RejectSchema = z.object({
  kycId: z.string().cuid('Invalid identifier.'),
  reason: z
    .string()
    .trim()
    .min(10, 'Tell the seller what was wrong, in enough detail that they can fix it.')
    .max(500),
});

export interface KycQueueItem {
  id: string;
  userId: string;
  legalName: string | null;
  idType: string | null;
  idLast4: string | null;
  gstin: string | null;
  status: KycStatus;
  tier: KycTier;
  submittedAt: Date | null;
  hasDocument: boolean;
  ownerEmail: string | null;
  ownerName: string | null;
  shopName: string | null;
  shopSlug: string | null;
  /** Hours since submission, for spotting a queue going stale. */
  ageHours: number | null;
}

/** Cases waiting on a human, oldest first. */
export async function getKycQueue(
  status: KycStatus = KycStatus.PENDING_REVIEW
): Promise<{ data: KycQueueItem[] } | { error: string }> {
  try {
    if (!(await isCurrentUserAdmin())) return { error: 'Not authorised.' };

    const rows = await db.sellerKyc.findMany({
      where: { status },
      orderBy: { submittedAt: 'asc' },
      take: 100,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            shop: { select: { name: true, slug: true } },
          },
        },
      },
    });

    const now = Date.now();
    return {
      data: rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        legalName: r.legalName,
        idType: r.idType,
        idLast4: r.idLast4,
        gstin: r.gstin,
        status: r.status,
        tier: r.tier,
        submittedAt: r.submittedAt,
        hasDocument: Boolean(r.documentPath),
        ownerEmail: r.user.email,
        ownerName: r.user.name,
        shopName: r.user.shop?.name ?? null,
        shopSlug: r.user.shop?.slug ?? null,
        ageHours: r.submittedAt
          ? Math.floor((now - r.submittedAt.getTime()) / 3_600_000)
          : null,
      })),
    };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'getKycQueue' }) };
  }
}

/**
 * A two-minute link to the document.
 *
 * Minted per request rather than stored, so a URL that leaks out of an admin's
 * browser history is useless within minutes. Every issuance is logged with the
 * reviewer's id: who looked at whose identity document, and when.
 */
export async function getKycDocumentUrl(
  kycId: string
): Promise<{ url: string; error?: undefined } | { error: string }> {
  try {
    const session = await getSession();
    if (!(await isCurrentUserAdmin())) return { error: 'Not authorised.' };

    const parsed = z.string().cuid().safeParse(kycId);
    if (!parsed.success) return { error: 'Invalid identifier.' };

    const kyc = await db.sellerKyc.findUnique({
      where: { id: parsed.data },
      select: { documentPath: true, userId: true },
    });
    if (!kyc?.documentPath) return { error: 'No document is attached to this case.' };

    const url = await signedKycDocumentUrl(kyc.documentPath);
    if (!url) return { error: 'The document could not be opened. It may already have been deleted.' };

    // Who looked at whose identity document, and when. Observational rather
    // than a mutation, so a failed audit write must not deny the reviewer the
    // document — but it is still recorded.
    if (session?.user?.id) {
      await recordAdminActionSafe({
        actorId: session.user.id,
        action: ADMIN_ACTIONS.VIEW_KYC_DOCUMENT,
        targetType: 'SellerKyc',
        targetId: parsed.data,
        metadata: { subjectUserId: kyc.userId },
      });
    }

    return { url };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'getKycDocumentUrl' }) };
  }
}

/**
 * The two checks both decisions need before they touch anything.
 *
 * `status` — a decision belongs on a case that was actually submitted. Without
 * this, any status except APPROVED was decidable, including one nobody had
 * filled in.
 *
 * `self` — nothing stopped an admin who owns a storefront from granting their
 * own shop the verified badge in one call. The audit row recorded it faithfully
 * and no check prevented it. Admins holding shops is contemplated elsewhere in
 * this codebase, so this is not hypothetical.
 */
function guardDecision(
  kyc: { status: KycStatus; userId: string },
  actorId: string | undefined
): string | null {
  if (kyc.status !== KycStatus.PENDING_REVIEW) {
    return 'This case is not awaiting review. Only a submitted case can be decided.';
  }
  if (actorId && kyc.userId === actorId) {
    return 'You cannot decide your own identity case. Ask another admin to review it.';
  }
  return null;
}

export async function approveKyc(
  raw: unknown
): Promise<{ success: true; error?: undefined } | { error: string }> {
  try {
    const session = await getSession();
    if (!(await isCurrentUserAdmin())) return { error: 'Not authorised.' };

    const parsed = DecisionSchema.safeParse(raw);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid request.' };

    const kyc = await db.sellerKyc.findUnique({
      where: { id: parsed.data.kycId },
      include: { user: { select: { email: true, shop: { select: { id: true, slug: true } } } } },
    });
    if (!kyc) return { error: 'Case not found.' };

    const blocked = guardDecision(kyc, session?.user?.id);
    if (blocked) return { error: blocked };

    /**
     * A decision is about evidence, so there has to be evidence.
     *
     * The only previous guard was "not already approved", which left every
     * other status approvable — including NOT_STARTED, a row `submitTier0`
     * creates with no ID type, no hash and no document. Approving one of those
     * put "a person looked at a document and agreed" in front of buyers when no
     * document had ever existed.
     */
    if (!kyc.idHash) {
      return { error: 'This case has no identity details on it, so there is nothing to approve.' };
    }

    await db.$transaction(async (tx) => {
      await tx.sellerKyc.update({
        where: { id: kyc.id },
        data: {
          status: KycStatus.APPROVED,
          tier: KycTier.TIER_1,
          reviewedById: session?.user?.id ?? null,
          reviewedAt: new Date(),
          rejectionReason: null,
          documentPath: null,
          documentDeletedAt: kyc.documentPath ? new Date() : null,
        },
      });

      // The verified badge finally means something: a person looked at a
      // document and agreed the seller is who they say.
      if (kyc.user.shop) {
        await tx.shop.update({
          where: { id: kyc.user.shop.id },
          data: { isVerified: true },
        });

        if (session?.user?.id) {
          await issueNotice(
            {
              shopId: kyc.user.shop.id,
              actorId: session.user.id,
              kind: NoticeKind.IDENTITY_DECISION,
              subject: 'Your identity has been verified',
              body:
                'We have reviewed your identity documents and verified your store. ' +
                'The verified badge is now showing to buyers, and your store is listed ' +
                'in the marketplace.',
            },
            tx
          );
        }
      }

      if (session?.user?.id) {
        await recordAdminAction(
          {
            actorId: session.user.id,
            action: ADMIN_ACTIONS.APPROVE_KYC,
            targetType: 'SellerKyc',
            targetId: kyc.id,
            metadata: { subjectUserId: kyc.userId, idLast4: kyc.idLast4 },
          },
          tx
        );
      }
    });

    // After the transaction: a failed delete must not roll back an approval.
    if (kyc.documentPath) await deleteKycDocument(kyc.documentPath);

    logger.info('KYC approved', { kycId: kyc.id, reviewerId: session?.user?.id });

    if (kyc.user.shop) {
      revalidateShopSurface(kyc.user.shop.slug);
      revalidateMarketplace();
    }
    revalidatePath('/admin/kyc');
    // The seller's own pages, which neither decision used to touch.
    revalidatePath('/verification');
    revalidatePath('/dashboard');
    revalidatePath('/notices');
    return { success: true };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'approveKyc' }) };
  }
}

export async function rejectKyc(
  raw: unknown
): Promise<{ success: true; error?: undefined } | { error: string }> {
  try {
    const session = await getSession();
    if (!(await isCurrentUserAdmin())) return { error: 'Not authorised.' };

    const parsed = RejectSchema.safeParse(raw);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid request.' };

    const kyc = await db.sellerKyc.findUnique({
      where: { id: parsed.data.kycId },
      include: { user: { select: { email: true, shop: { select: { id: true, slug: true } } } } },
    });
    if (!kyc) return { error: 'Case not found.' };

    const blocked = guardDecision(kyc, session?.user?.id);
    if (blocked) return { error: blocked };

    await db.$transaction(async (tx) => {
      await tx.sellerKyc.update({
      where: { id: kyc.id },
      data: {
        status: KycStatus.REJECTED,
        reviewedById: session?.user?.id ?? null,
        reviewedAt: new Date(),
        rejectionReason: parsed.data.reason,
        documentPath: null,
        documentDeletedAt: kyc.documentPath ? new Date() : null,
      },
      });

      /**
       * Take the badge back.
       *
       * `approveKyc` sets `isVerified`; this never cleared it. So the sequence
       * that matters most — approve, discover the document was forged, reject —
       * left the emerald verified badge on the storefront and the shop in the
       * verified homepage rail. The seller saw a rejection; every buyer saw a
       * verified seller. The only cure was an unrelated toggle in another screen
       * that a reviewer working this queue has no reason to know exists.
       */
      if (kyc.user.shop) {
        await tx.shop.update({
          where: { id: kyc.user.shop.id },
          data: { isVerified: false },
        });

        if (session?.user?.id) {
          await issueNotice(
            {
              shopId: kyc.user.shop.id,
              actorId: session.user.id,
              kind: NoticeKind.IDENTITY_DECISION,
              subject: 'We could not verify your identity documents',
              // The reason verbatim. A seller who cannot see what was wrong
              // resubmits the same thing and we both waste the round trip.
              body:
                `${parsed.data.reason}\n\n` +
                'You can submit again from your verification page once you have ' +
                'addressed this.',
            },
            tx
          );
        }
      }
      if (session?.user?.id) {
        await recordAdminAction(
          {
            actorId: session.user.id,
            action: ADMIN_ACTIONS.REJECT_KYC,
            targetType: 'SellerKyc',
            targetId: kyc.id,
            reason: parsed.data.reason,
            metadata: { subjectUserId: kyc.userId },
          },
          tx
        );
      }
    });

    if (kyc.documentPath) await deleteKycDocument(kyc.documentPath);

    logger.info('KYC rejected', { kycId: kyc.id, reviewerId: session?.user?.id });
    revalidatePath('/admin/kyc');
    // The seller's own pages, which neither decision used to touch.
    revalidatePath('/verification');
    revalidatePath('/dashboard');
    revalidatePath('/notices');
    return { success: true };
  } catch (error) {
    return { error: toUserMessage(error, { action: 'rejectKyc' }) };
  }
}
