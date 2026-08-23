import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { ALLOWED_IMAGE_HOSTS } from "./src/shared/lib/image-hosts";

// Content Security Policy
// - script-src: 'unsafe-inline' is required by Next.js runtime inline scripts;
//   PostHog loads its recorder/bundle from *.posthog.com asset hosts.
// - connect-src: PostHog event ingestion + Supabase storage API.
// - img-src: Supabase buckets, Unsplash (seed/demo images), Google avatars (OAuth).
const isDev = process.env.NODE_ENV === 'development';
const ContentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ""} https://*.posthog.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://*.supabase.co https://images.unsplash.com https://lh3.googleusercontent.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.posthog.com https://*.supabase.co https://*.sentry.io",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: ContentSecurityPolicy },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  // The seller platform runs on a second host (SELLER_HOSTS defaults to
  // 127.0.0.1:3000). Without this, Next 16's dev server treats it as a
  // cross-origin request and the seller pages never hydrate locally.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  images: {
    // Single source of truth, shared with the Zod image validators so a URL
    // that next/image cannot render can never be stored. See
    // src/shared/lib/image-hosts.ts.
    remotePatterns: [...ALLOWED_IMAGE_HOSTS],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
