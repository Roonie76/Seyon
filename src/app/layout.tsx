import type { Metadata } from "next";
import { IM_Fell_Double_Pica } from "next/font/google";
import "./globals.css";
import { PostHogProvider } from "@/components/shared/posthog-provider";
import { JourneyProvider } from "@/components/shared/journey-context";
import { SITE_URL } from "@/lib/site";
import { generateWebsiteJSONLD, generateOrganizationJSONLD, safeJsonLdStringify } from "@/lib/seo";

/**
 * One face, everywhere.
 *
 * IM Fell Double Pica is a revival of a 17th-century English cut and ships a
 * single weight -- 400, roman and italic. There is no bold. Rather than let the
 * browser smear a fake one across the ~1,000 places this codebase asks for
 * bold, `font-synthesis-weight: none` in globals.css turns synthesis off, and
 * hierarchy is carried by size, capitals, letter-spacing and colour instead,
 * which is how the face was set when it was cut.
 *
 * It fills all three roles -- sans, serif and mono -- because uniformity was
 * the point. The mono slot is the one to revisit if figures in tables read
 * badly: the numerals here are proportional, not tabular.
 */
const imFell = IM_Fell_Double_Pica({
  variable: "--font-im-fell",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  display: "swap",
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
      className={`${imFell.variable} h-full antialiased dark`}
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
