import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";
import { ToastProvider } from "@/lib/toast";
import { AuthGuard } from "@/components/AuthGuard";
import { CryptoProvider } from "@/lib/use-crypto";
import { AlertBannerProvider } from "@/components/ui/alert-banner";

export const metadata: Metadata = {
  title: "Love1Another - Christian Prayer List App",
  description:
    "A private, personal Christian prayer list app for keeping track of prayers for your loved ones. Manage prayer requests, track answered prayers, and stay connected with your faith community.",
  keywords: [
    "prayer list",
    "Christian prayer app",
    "prayer request app",
    "love one another",
    "prayer tracker",
    "faith app",
    "Christian app",
    "prayer journal",
    "prayer requests",
    "answered prayers",
  ],
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/favicon.jpeg", type: "image/jpeg" }],
    apple: [{ url: "/favicon.jpeg", type: "image/jpeg" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Love1Another",
  },
  openGraph: {
    title: "Love1Another - Christian Prayer List App",
    description:
      "A private, personal Christian prayer list app for keeping track of prayers for your loved ones.",
    type: "website",
    siteName: "Love1Another",
  },
  twitter: {
    card: "summary",
    title: "Love1Another - Christian Prayer List App",
    description:
      "A private, personal Christian prayer list app for keeping track of prayers for your loved ones.",
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
      </body>
    </html>
  );
}
