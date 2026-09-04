'use server';

import crypto from 'crypto';
import { WhatsappVerifiedVia } from '@prisma/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { rateLimit, RATE_LIMITS } from '../lib/rate-limit';
import { logger } from '../lib/logger';
import { notify } from '../lib/notify';
import { appSecret } from '../lib/app-secret';
import { revalidateShopSurface } from '@/shared/lib/cache';

function normalizeWhatsapp(number: string) {
  return number.replace(/[^\d]/g, '');
}

function hashCode(shopId: string, code: string) {
  const secret = appSecret();
  return crypto.createHmac('sha256', secret).update(`${shopId}:${code}`).digest('hex');
}

/**
 * Constant-time digest comparison.
 *
 * `!==` short-circuits on the first differing character. The practical leak is
 * small — the attacker controls the guessed code, not the digest, and the
 * confirm limiter allows six attempts an hour — but this is the standard
 * hardening on a secret-comparison path and it costs one line.
 */
function hashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}


function generateCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

async function getOwnedShop() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const shop = await db.shop.findUnique({
    where: { ownerId: session.user.id },
    include: { owner: { select: { email: true } } },
  });

  // Both branches end in the same place — there is no shop to act on — so the
  // admin check only ever changed the wording. It read the JWT claim to do it,
  // which is exactly the pattern that made the claim worth forging.
  if (!shop) {
    throw new Error('You do not own a storefront');
  }

  return shop;
}

/**
 * Why a WhatsApp send did not happen, not merely that it did not.
 *
 * These two are the same to the code path and completely different to the
 * person on the other end. `unconfigured` is a deployment that has not been
 * finished. `failed` is an integration that is wired up and being rejected —
 * an unapproved template, a number not registered to the app, an expired
 * token — and it is the state where a seller sits in a loop being told to
 * retry the thing that keeps failing. Telling them apart is what lets the UI
 * say "this is us, not your number".
 */
type SendOutcome = 'sent' | 'unconfigured' | 'failed';

async function sendWhatsappTemplate(to: string, code: string): Promise<SendOutcome> {
  const token = process.env.WHATSAPP_CLOUD_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const template = process.env.WHATSAPP_VERIFY_TEMPLATE_NAME;
  const language = process.env.WHATSAPP_VERIFY_TEMPLATE_LANGUAGE || 'en';

  if (!token || !phoneNumberId || !template) {
    return 'unconfigured';
  }

  const parameters = template.startsWith('jaspers_market_order_confirmation')
    ? [
        { type: 'text', text: 'Store Owner' },
        { type: 'text', text: code },
        { type: 'text', text: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
      ]
    : [{ type: 'text', text: code }];

  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: template,
        language: { code: language },
        components: [
          {
            type: 'body',
            parameters,
          },
        ],
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    /**
     * Error, not warn.
     *
     * This is the integration that decides whether any seller can be listed.
     * A warning is something to look at eventually; this is the line that
     * explains why nobody can onboard, and it should be the first thing a
     * search of the logs surfaces. The Graph body carries Meta's own reason —
     * usually an unapproved template or a parameter-count mismatch — so it is
     * logged verbatim rather than summarised.
     */
    logger.error('WHATSAPP_SEND_REJECTED: Meta refused the verification template', undefined, {
      status: res.status,
      body,
      template,
    });
    return 'failed';
  }

  return 'sent';
}

export async function requestWhatsappVerification() {
  try {
    const shop = await getOwnedShop();
    const rl = await rateLimit(
      `whatsapp-verify-request:${shop.id}`,
      RATE_LIMITS.WHATSAPP_VERIFY_REQUEST.limit,
      RATE_LIMITS.WHATSAPP_VERIFY_REQUEST.windowMs,
      Date.now(),
      // Guards a secret, so a broken limiter must deny rather than uncap.
      { failClosed: true }
    );

    if (!rl.success) {
      return { error: `Too many verification requests. Try again in ${rl.retryAfterSeconds} seconds.` };
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const [, created] = await db.$transaction([
      db.whatsappVerification.updateMany({
        where: { shopId: shop.id, consumedAt: null },
        data: { consumedAt: new Date() },
      }),
      db.whatsappVerification.create({
        data: {
          shopId: shop.id,
          codeHash: hashCode(shop.id, code),
          expiresAt,
        },
      }),
    ]);

    const outcome = await sendWhatsappTemplate(normalizeWhatsapp(shop.whatsapp), code);
    const deliveredByWhatsapp = outcome === 'sent';

    /**
     * Whether the email actually left, not whether we tried.
     *
     * This return value used to be discarded. `notify()` returns
     * `{ sent: false }` and logs at debug level when Resend is unconfigured, so
     * with neither channel set up the action reported `delivery: 'email'` and
     * the seller was shown "code sent" while nothing had been sent anywhere.
     * A false confirmation is worse than a failure: it ends the seller's
     * troubleshooting, and there is no code coming.
     */
    let deliveredByEmail = false;
    if (!deliveredByWhatsapp && shop.owner.email) {
      const emailed = await notify({
        to: shop.owner.email,
        subject: 'Your Seyon WhatsApp verification code',
        text: `Your Seyon verification code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`,
      });
      deliveredByEmail = emailed.sent;
    }

    const isDev = process.env.NODE_ENV !== 'production';

    if (!deliveredByWhatsapp && !deliveredByEmail) {
      // Outside production the code is handed back so local work is possible.
      if (isDev) {
        // Local work confirms through the email-grade path, never the WhatsApp one.
        await db.whatsappVerification.update({
          where: { id: created.id },
          data: { deliveredVia: WhatsappVerifiedVia.EMAIL },
        });
        return { success: true, delivery: 'dev' as const, expiresAt, devCode: code };
      }
      logger.error('WHATSAPP_VERIFY_UNDELIVERABLE: no channel accepted the code', undefined, {
        shopId: shop.id,
        hasEmail: Boolean(shop.owner.email),
      });
      return {
        error:
          'We could not send your code — our verification service is not reachable right now. ' +
          'Nothing is wrong with your number. Please try again shortly, and contact support if it keeps failing.',
      };
    }

    // Stamp the channel on the row that will be confirmed, so the shop's
    // verification state records how it was actually proved.
    await db.whatsappVerification.update({
      where: { id: created.id },
      data: {
        deliveredVia: deliveredByWhatsapp
          ? WhatsappVerifiedVia.WHATSAPP
          : WhatsappVerifiedVia.EMAIL,
      },
    });

    return {
      success: true,
      delivery: (deliveredByWhatsapp ? 'whatsapp' : 'email') as 'whatsapp' | 'email',
      /**
       * Why the code went to email, when it did.
       *
       * The seller needs this at the moment of the fallback, not two screens
       * later. Confirming an emailed code sets the shop to EMAIL, which is not
       * enough to be listed — so without this they verify "successfully", hit
       * the listing refusal, are told to use WhatsApp, click the same button,
       * and go round again. Naming the cause here ends the loop at the first
       * turn and stops them suspecting their own number.
       */
      whatsappOutcome: outcome,
      expiresAt,
    };
  } catch (error) {
    logger.error('Error requesting WhatsApp verification', error);
    return { error: error instanceof Error ? error.message : 'An unexpected error occurred' };
  }
}

export async function confirmWhatsappVerification(rawCode: string) {
  try {
    const shop = await getOwnedShop();
    const code = rawCode.trim();
    if (!/^\d{6}$/.test(code)) {
      return { error: 'Enter the 6-digit verification code' };
    }

    const rl = await rateLimit(
      `whatsapp-verify-confirm:${shop.id}`,
      RATE_LIMITS.WHATSAPP_VERIFY_CONFIRM.limit,
      RATE_LIMITS.WHATSAPP_VERIFY_CONFIRM.windowMs,
      Date.now(),
      // Guards a secret, so a broken limiter must deny rather than uncap.
      { failClosed: true }
    );

    if (!rl.success) {
      return { error: `Too many code attempts. Try again in ${rl.retryAfterSeconds} seconds.` };
    }

    const verification = await db.whatsappVerification.findFirst({
      where: {
        shopId: shop.id,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification) {
      return { error: 'No active verification code. Request a new one.' };
    }

    if (verification.attempts >= 5) {
      await db.whatsappVerification.update({
        where: { id: verification.id },
        data: { consumedAt: new Date() },
      });
      return { error: 'Too many incorrect attempts. Request a new code.' };
    }

    if (!hashesMatch(verification.codeHash, hashCode(shop.id, code))) {
      await db.whatsappVerification.update({
        where: { id: verification.id },
        data: { attempts: { increment: 1 } },
      });
      return { error: 'Incorrect verification code' };
    }

    await db.$transaction([
      db.whatsappVerification.update({
        where: { id: verification.id },
        data: { consumedAt: new Date() },
      }),
      db.shop.update({
        where: { id: shop.id },
        data: {
          whatsappVerifiedAt: new Date(),
          /**
           * Which channel proved it, recorded rather than assumed.
           *
           * A code read out of the seller's own inbox proves they can read
           * their own inbox. It does not prove they hold the number they typed
           * into the form — so before this column existed, a seller could enter
           * anybody's number and be marked verified. Discovery is gated on
           * WHATSAPP alone; EMAIL keeps the store working by direct link.
           */
          whatsappVerifiedVia: verification.deliveredVia ?? WhatsappVerifiedVia.EMAIL,
        },
      }),
    ]);

    revalidateShopSurface(shop.slug);
    return { success: true };
  } catch (error) {
    logger.error('Error confirming WhatsApp verification', error);
    return { error: error instanceof Error ? error.message : 'An unexpected error occurred' };
  }
}
