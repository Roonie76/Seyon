/**
 * The email-only Credentials provider has NO password check — it exists for
 * local development and demos. It must never run in production.
 *
 * Two independent conditions are required:
 *   1. ALLOW_INSECURE_DEV_LOGIN=true  (explicit opt-in)
 *   2. NODE_ENV !== 'production'      (hard ceiling)
 *
 * Condition 2 exists because condition 1 has already leaked into a local
 * .env.local once. An env var that reaches a Vercel project must not be able
 * to turn on passwordless sign-in for every account, admins included.
 */
export function isDevLoginEnabled(
  override: string | undefined = process.env.ALLOW_INSECURE_DEV_LOGIN,
  nodeEnv: string | undefined = process.env.NODE_ENV
): boolean {
  if (nodeEnv === 'production') return false;
  return override === 'true';
}
