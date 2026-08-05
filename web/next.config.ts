import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./lib/i18n/request.ts')

/**
 * Local-only relaxations for the development media store. Never set in a real
 * deployment; see the comments on the image options below.
 */
const ALLOW_LOCAL_IMAGES = process.env.ALLOW_LOCAL_IMAGE_HOSTS === 'true'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // This app sits in a monorepo with several lockfiles; pin the trace root so
  // Next stops guessing (and warning) about the workspace boundary.
  outputFileTracingRoot: __dirname,
  images: {
    /*
     * Next 16 refuses to optimise an upstream image whose hostname resolves to a
     * private IP, as SSRF protection. In local development the media store is
     * MinIO on localhost:9000, which is exactly that, so the guard must be lifted
     * to see any seeded imagery.
     *
     * Gated behind an explicit opt-in rather than NODE_ENV, because `next start`
     * also runs as production and the e2e suite tests a production build. Real
     * deployments simply never set this flag, so the SSRF guard stays on where it
     * matters — leaving it enabled would let the image endpoint probe internal
     * services.
     */
    dangerouslyAllowLocalIP: ALLOW_LOCAL_IMAGES,
    /*
     * The seeded dev media in MinIO is SVG content served under .jpg filenames.
     * SVG can embed scripts, so Next blocks it by default; the CSP below strips
     * that capability (no scripts, sandboxed) which is the documented mitigation.
     * Both are tied to the same local-only flag.
     */
    dangerouslyAllowSVG: ALLOW_LOCAL_IMAGES,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // MinIO (self-hosted media) in dev, plus the QR service the backend uses for
    // ticket QR codes. Tighten this list for production.
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '9000', pathname: '/**' },
      { protocol: 'https', hostname: '*.derlg.com', pathname: '/**' },
      { protocol: 'https', hostname: 'api.qrserver.com', pathname: '/**' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ]
  },
}

export default withNextIntl(nextConfig)
