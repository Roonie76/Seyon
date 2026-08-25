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

/**
 * Origin the admin screens actually live on.
 *
 * `/admin` is a seller-host route: on the shopper host, middleware sends it
 * to the homepage. So a link built from SITE_URL is wrong whenever the code
 * runs on the shopper deployment — and it does, because the same repository
 * is deployed as two Vercel projects and `vercel.json` registers the nightly
 * cron on both of them. The admin who followed last night's digest link
 * landed on the marketplace.
 *
 * Derived from SELLER_HOSTS so it is correct from either deployment. Falls
 * back to SITE_URL when that is unset, which is right in development (one
 * host serves everything) and merely no worse than before in production.
 */
export function adminOriginFrom(sellerHosts: string | undefined, siteUrl: string): string {
  const first = (sellerHosts || '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean)[0];

  if (!first) return siteUrl;

  // A host with a scheme already on it is taken as given; SELLER_HOSTS is
  // documented as bare hostnames, but a value copied from a browser bar
  // should not produce "https://https://…".
  if (/^https?:\/\//i.test(first)) return first.replace(/\/$/, '');

  const local = /^(localhost|127\.0\.0\.1)(:|$)/.test(first);
  return `${local ? 'http' : 'https'}://${first}`;
}

export const ADMIN_URL: string = adminOriginFrom(process.env.SELLER_HOSTS, SITE_URL);
