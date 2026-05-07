import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow external images for avatar URLs etc
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  // Environment variables
  env: {
    NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001',
  },
};

export default nextConfig;
