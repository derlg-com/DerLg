import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Next.js 16 blocks loopback/local-IP image optimization by default (SSRF guard).
    // MinIO runs on localhost:9000 in dev, so this is required for trip/hotel images.
    dangerouslyAllowLocalIP: true,
    // Seed placeholder images are SVGs served with a .jpg extension; allow SVG
    // optimization (trusted local MinIO source only).
    dangerouslyAllowSVG: true,
    remotePatterns: [
      { protocol: 'https', hostname: '**.derlg.com' },
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'cdn.derlg.com' },
      { protocol: 'https', hostname: '*.amazonaws.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'api.qrserver.com' },
      { protocol: 'http', hostname: 'localhost', port: '9000', pathname: '/**' },
    ],
  },
};

export default nextConfig;
