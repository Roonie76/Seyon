import type { Metadata } from "next";
import { Geist, Geist_Mono, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import { PostHogProvider } from "@/components/shared/posthog-provider";
import { SITE_URL } from "@/lib/site";
import { generateWebsiteJSONLD, generateOrganizationJSONLD, safeJsonLdStringify } from "@/lib/seo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-serif-custom",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["italic", "normal"],
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
      className={`${geistSans.variable} ${geistMono.variable} ${cormorantGaramond.variable} h-full antialiased dark`}
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
          {children}
        </PostHogProvider>
      </body>
    </html>
  );
}
