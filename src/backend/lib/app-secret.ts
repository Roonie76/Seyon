/**
 * The one secret, resolved in one place.
 *
 * Three call sites used to read it three different ways, and the disagreement
 * was silent rather than loud:
 *
 *   auth.ts      AUTH_SECRET || NEXTAUTH_SECRET
 *   kyc.ts       AUTH_SECRET ?? ''                      <- salts the PAN hash
 *   whatsapp.ts  NEXTAUTH_SECRET || 'local-dev-secret'  <- keys the code HMAC
 *
 * `env-check` passes when *either* name is set, and its message tells operators
 * to "Set AUTH_SECRET". Follow that advice and the WhatsApp verification code
 * is keyed on a string committed to this repository. Set only the legacy name
 * and the PAN salt is the empty string — an unsalted SHA-256 over a keyspace
 * of about three billion, which is precisely the attack the comment above that
 * hash was written to prevent. Both deployments boot cleanly and neither
 * condition is visible at runtime.
 *
 * So: one resolver, and it throws. A default value for a secret is a bug with
 * a long fuse — it works everywhere until the day the data is dumped.
 */

let cached: string | null = null;

export function appSecret(): string {
  if (cached) return cached;

  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

  if (!secret || secret.trim() === '') {
    throw new Error(
      'No application secret is set. AUTH_SECRET (or NEXTAUTH_SECRET) is required — ' +
        'it signs sessions, salts identity hashes and keys verification codes. ' +
        'Refusing to fall back to a default, which would make all three forgeable.'
    );
  }

  cached = secret;
  return secret;
}

/** Test seam: the cache is process-wide, so a test changing the env must clear it. */
export function resetAppSecretCache(): void {
  cached = null;
}
