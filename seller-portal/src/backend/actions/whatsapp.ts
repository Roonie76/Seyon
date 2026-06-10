'use server';

import crypto from 'crypto';
import { Role } from '@prisma/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { rateLimit, RATE_LIMITS } from '../lib/rate-limit';
import { logger } from '../lib/logger';
import { notify } from '../lib/notify';
import { revalidateShopSurface } from '@/shared/lib/cache';

function normalizeWhatsapp(number: string) {
  return number.replace(/[^\d]/g, '');
}

function hashCode(shopId: string, code: string) {
  const secret = process.env.NEXTAUTH_SECRET || 'local-dev-secret';
  return crypto.createHmac('sha256', secret).update(`${shopId}:${code}`).digest('hex');
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

  if (!shop && session.user.role !== Role.ADMIN) {
    throw new Error('You do not own a storefront');
  }

  if (!shop) {
    throw new Error('Storefront not found');
  }

  return shop;
}

async function sendWhatsappTemplate(to: string, code: string) {
  const token = process.env.WHATSAPP_CLOUD_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const template = process.env.WHATSAPP_VERIFY_TEMPLATE_NAME;
  const language = process.env.WHATSAPP_VERIFY_TEMPLATE_LANGUAGE || 'en';

  if (!token || !phoneNumberId || !template) {
    return false;
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
    logger.warn('WhatsApp verification template send failed', { status: res.status, body });
    return false;
  }

  return true;
}

export async function requestWhatsappVerification() {
  try {
    const shop = await getOwnedShop();
    const rl = rateLimit(
      `whatsapp-verify-request:${shop.id}`,
      RATE_LIMITS.WHATSAPP_VERIFY_REQUEST.limit,
      RATE_LIMITS.WHATSAPP_VERIFY_REQUEST.windowMs
    );

    if (!rl.success) {
      return { error: `Too many verification requests. Try again in ${rl.retryAfterSeconds} seconds.` };
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.$transaction([
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

    const deliveredByWhatsapp = await sendWhatsappTemplate(normalizeWhatsapp(shop.whatsapp), code);

    if (!deliveredByWhatsapp && shop.owner.email) {
      await notify({
        to: shop.owner.email,
        subject: 'Your Seyon WhatsApp verification code',
        text: `Your Seyon verification code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`,
      });
    }

    if (!deliveredByWhatsapp && !shop.owner.email && process.env.NODE_ENV === 'production') {
      return { error: 'WhatsApp verification delivery is not configured. Add WhatsApp Cloud API settings or a seller email.' };
    }

    return {
      success: true,
      delivery: deliveredByWhatsapp ? 'whatsapp' : shop.owner.email ? 'email' : 'dev',
      expiresAt,
      ...(process.env.NODE_ENV !== 'production' && !deliveredByWhatsapp && !shop.owner.email ? { devCode: code } : {}),
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

    const rl = rateLimit(
      `whatsapp-verify-confirm:${shop.id}`,
      RATE_LIMITS.WHATSAPP_VERIFY_CONFIRM.limit,
      RATE_LIMITS.WHATSAPP_VERIFY_CONFIRM.windowMs
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

    if (verification.codeHash !== hashCode(shop.id, code)) {
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
        data: { whatsappVerifiedAt: new Date() },
      }),
    ]);

    revalidateShopSurface(shop.slug);
    return { success: true };
  } catch (error) {
    logger.error('Error confirming WhatsApp verification', error);
    return { error: error instanceof Error ? error.message : 'An unexpected error occurred' };
  }
}
