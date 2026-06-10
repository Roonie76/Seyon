import { logger } from './logger';

/**
 * Transactional email via Resend's REST API — no SDK dependency.
 *
 * Setup: set RESEND_API_KEY and NOTIFY_FROM_EMAIL (a verified sender domain
 * in Resend). When unset, notifications no-op with a debug log, so the app
 * works fine without email configured (local dev, early production).
 */

interface NotifyArgs {
  to: string;
  subject: string;
  /** Plain-text body. Kept simple deliberately — transactional, not marketing. */
  text: string;
}

export async function notify({ to, subject, text }: NotifyArgs): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM_EMAIL;

  if (!apiKey || !from) {
    logger.debug('notify(): email not configured, skipping', { to, subject });
    return { sent: false };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, text }),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.error('notify(): Resend API error', undefined, { status: res.status, body: body.slice(0, 300), subject });
      return { sent: false };
    }

    return { sent: true };
  } catch (error) {
    // Email failures must never break the user-facing action.
    logger.error('notify(): send failed', error, { subject });
    return { sent: false };
  }
}
