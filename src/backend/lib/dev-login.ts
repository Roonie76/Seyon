/**
 * The email-only Credentials provider has NO password check — it exists for
 * local development and demos. It must never run in production.
 *
 * Escape hatch: set ALLOW_INSECURE_DEV_LOGIN=true to force-enable it
 * (e.g. on a throwaway staging deployment). Never set this on a real domain.
 */
export function isDevLoginEnabled(
  nodeEnv: string | undefined = process.env.NODE_ENV,
  override: string | undefined = process.env.ALLOW_INSECURE_DEV_LOGIN
): boolean {
  if (override === 'true') return true;
  return nodeEnv !== 'production';
}
