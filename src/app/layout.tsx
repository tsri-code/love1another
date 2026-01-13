import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";
import { ToastProvider } from "@/lib/toast";
import { AuthGuard } from "@/components/AuthGuard";
import { CryptoProvider } from "@/lib/use-crypto";
import { AlertBannerProvider } from "@/components/ui/alert-banner";
import { Analytics } from "@vercel/analytics/react";

export const metadata: Metadata = {
  title: "Love1Another - Christian Prayer List and Connection App",
  description:
    "Love1Another - Christian Prayer List and Connection App. A private, personal prayer request app for keeping track of prayers for your loved ones. Manage prayer requests, track answered prayers, and stay connected.",
  keywords: [
    "prayer app",
    "prayer list",
    "Christian prayer app",
    "prayer request app",
    "love one another",
    "prayer tracker",
    "faith app",
    "Christian app",
    "prayer journal",
    "prayer requests",
    "christian social network",
    "christian social app",
    "christian social network app",
    "christian social network app",
    "answered prayers",
  ],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Love1Another",
  },
  openGraph: {
    title: "Love1Another - Christian Prayer List and Connection App",
    description:
      "A private, personal prayer request app for keeping track of prayers for your loved ones.",
    type: "website",
    siteName: "Love1Another",
  },
  twitter: {
    card: "summary",
    title: "Love1Another - Christian Prayer List and Connection App",
    description:
      "A private, personal prayer request app for keeping track of prayers for your loved ones.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1715" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <ToastProvider>
            <AlertBannerProvider>
              <CryptoProvider>
                <AuthGuard>{children}</AuthGuard>
              </CryptoProvider>
            </AlertBannerProvider>
          </ToastProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
