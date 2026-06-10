import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PostHogProvider } from "@/components/shared/posthog-provider";
import { SITE_URL } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground animate-fade-in">
        <PostHogProvider>
          {children}
        </PostHogProvider>
      </body>
    </html>
  );
}
