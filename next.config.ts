import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },

  // Security headers for all routes
  async headers() {
    return [
      {
        // Apply to all routes
        source: "/:path*",
        headers: [
          // Prevent MIME type sniffing
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // Prevent clickjacking
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          // XSS Protection (legacy but still useful)
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          // Referrer Policy - don't leak referrer info
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // Permissions Policy - restrict browser features
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          // Strict Transport Security (HTTPS only) - enable in production
          ...(process.env.NODE_ENV === "production"
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains",
                },
              ]
            : []),
          // Content Security Policy
          {
            key: "Content-Security-Policy",
            value: [
              // Default to self
              "default-src 'self'",
              // Scripts: self + inline for Next.js hydration
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              // Styles: self + inline for styled-jsx and CSS-in-JS
              "style-src 'self' 'unsafe-inline'",
              // Images: self + data URIs + Supabase storage
              "img-src 'self' data: blob: https://*.supabase.co",
              // Fonts: self + Google Fonts
              "font-src 'self' https://fonts.gstatic.com",
              // Connect: self + Supabase API
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
              // Frame ancestors: none (prevent embedding)
              "frame-ancestors 'none'",
              // Form actions: self only
              "form-action 'self'",
              // Base URI: self
              "base-uri 'self'",
              // Object sources: none
              "object-src 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
