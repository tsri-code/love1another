import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";
import { ToastProvider } from "@/lib/toast";
import { AuthGuard } from "@/components/AuthGuard";
import { CryptoProvider } from "@/lib/use-crypto";
import { AlertBannerProvider } from "@/components/ui/alert-banner";

export const metadata: Metadata = {
  title: "Love One Another | Christian Prayer App",
  description:
    "A private, personal prayer request app for keeping track of prayers for your loved ones. Manage prayer requests, track answered prayers, and stay connected.",
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
    "answered prayers",
  ],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Love One Another",
  },
  openGraph: {
    title: "Love One Another | Christian Prayer App",
    description:
      "A private, personal prayer request app for keeping track of prayers for your loved ones.",
    type: "website",
    siteName: "Love One Another",
  },
  twitter: {
    card: "summary",
    title: "Love One Another | Christian Prayer App",
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
      </body>
    </html>
  );
}
