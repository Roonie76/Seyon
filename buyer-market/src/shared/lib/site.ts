/**
 * Canonical public URL of the current deployment.
 *
 * Resolution order:
 *  1. NEXT_PUBLIC_SITE_URL — explicit canonical URL (set this in production).
 *  2. NEXTAUTH_URL         — legacy fallback so existing deployments keep working.
 *  3. http://localhost:3000 — local development only.
 *
 * In production builds, a missing explicit URL logs a loud warning instead of
 * silently emitting localhost into sitemaps, canonicals, and OpenGraph tags.
 */
const explicit = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL;

if (!explicit && process.env.NODE_ENV === 'production') {
  console.warn(
    '[seyon] NEXT_PUBLIC_SITE_URL is not set — SEO URLs (sitemap, canonical, OpenGraph) ' +
    'will point to localhost. Set NEXT_PUBLIC_SITE_URL to the public domain.'
  );
}

export const SITE_URL: string = (explicit || 'http://localhost:3000').replace(/\/$/, '');
