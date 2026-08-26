import type { Metadata } from "next";
import { Fraunces } from "next/font/google";
import "./globals.css";
import { PostHogProvider } from "@/components/shared/posthog-provider";
import { JourneyProvider } from "@/components/shared/journey-context";
import { SITE_URL } from "@/lib/site";
import { generateWebsiteJSONLD, generateOrganizationJSONLD, safeJsonLdStringify } from "@/lib/seo";

/**
 * One face, everywhere.
 *
 * Fraunces is a variable family: a weight axis from 300 to 800 and an optical
 * size axis, which is the part that matters here. `opsz` means the 48px hero
 * and the 11px uppercase label are drawn as different shapes rather than the
 * same shape scaled -- thicker hairlines and looser spacing at small sizes,
 * finer contrast at large ones. Browsers apply it automatically via
 * `font-optical-sizing: auto`, which is the default.
 *
 * That axis is why this replaced IM Fell Double Pica. IM Fell was one static
 * cut drawn for roughly 22pt, so it had nothing to give at 11px and no bold at
 * all -- and this codebase asks for bold in about a thousand places. Fraunces
 * has real weights, so no synthesis rule is needed and none should be added:
 * `font-synthesis-weight: none` would now flatten every one of them.
 *
 * It fills all three roles -- sans, serif and mono -- because a single face was
 * the brief. Fraunces carries tabular figures, so prices and table columns
 * still line up.
 */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  // next/font ships only the weight axis unless the others are asked for by
  // name. Without this line the font file carries `wght` alone,
  // `font-optical-sizing: auto` has nothing to act on, and the reason this
  // family was chosen quietly does not happen. Verified by reading the `fvar`
  // table out of the built woff2 rather than trusting the CSS.
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: {
    default: "Seyon | Social Commerce Storefronts",
    template: "%s | Seyon",
  },
  description: "Create a free, instant storefront for WhatsApp, Instagram, and Telegram sales. List your products and receive orders directly on chat.",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    siteName: "Seyon Marketplace",
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
  },
  verification: {
    google: "bgyV_NqsC9E2ee1Iy55ZUJo3tCn15j3DVSjlh4tDGaI",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground animate-fade-in">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(generateWebsiteJSONLD()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(generateOrganizationJSONLD()) }}
        />
        <PostHogProvider>
          <JourneyProvider>
            {children}
          </JourneyProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
