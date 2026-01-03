import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Handle native modules (better-sqlite3, argon2)
  serverExternalPackages: ['better-sqlite3', 'argon2'],
  
  // Disable static page generation for API routes
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
