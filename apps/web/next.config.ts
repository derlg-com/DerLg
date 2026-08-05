import type { NextConfig } from 'next';

/**
 * R2 public host allowlist. Read from the environment at config-build time so
 * the same `next.config.ts` works in dev (no R2) and prod (R2 custom domain).
 * When `R2_PUBLIC_BASE_URL` is unset nothing is added, so the build never
 * breaks on a machine that has not wired up storage yet.
 */
const r2PublicBaseUrl = process.env.R2_PUBLIC_BASE_URL;

const remotePatterns: NonNullable<NonNullable<NextConfig['images']>['remotePatterns']> = [];

if (r2PublicBaseUrl) {
  try {
    const { hostname, protocol, port } = new URL(r2PublicBaseUrl);
    remotePatterns.push({
      protocol: protocol.replace(':', '') as 'http' | 'https',
      hostname,
      ...(port ? { port } : {}),
    });
  } catch {
    // A malformed R2_PUBLIC_BASE_URL should not take the whole build down; the
    // operator will see 403s from the Next image optimizer instead.
  }
}

const nextConfig: NextConfig = {
  // Standalone bundles the server + a minimal node_modules into .next/standalone
  // so the production Docker image needs no node_modules mount — only .next
  // and public/. No effect on `next dev` or the dev experience.
  output: 'standalone',
  reactStrictMode: true,
  images: {
    // Seeded images served from /public in dev; R2 host added when configured.
    remotePatterns,
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;