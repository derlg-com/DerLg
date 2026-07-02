// Serwist CLI configuration (configurator mode) — PWA plugin (Requirements 12.1, 12.2, 12.3, 12.4, 12.7).
//
// Why configurator mode instead of the `@serwist/next` webpack plugin:
// This project runs Next.js 16 with Turbopack as the default bundler. The
// standard `@serwist/next` plugin injects a webpack config, which conflicts with
// Turbopack and fails the build. Configurator mode keeps next.config.ts free of
// any bundler-specific config (Turbopack stays the default) and instead generates
// the service worker as a separate post-build step via `@serwist/cli`.
//
// Usage (wired into package.json):
//   next build && serwist build serwist.config.mjs
//
// `serwist` (from @serwist/next/config) reads the fully-resolved Next.js config
// and produces the @serwist/cli BuildOptions, including the precache manifest
// glob patterns derived from the Next.js build output (.next/static, etc.).

import { serwist } from '@serwist/next/config'

export default await serwist.withNextConfig(() => ({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  // Precache prerendered routes so navigations work offline (Requirement 12.5).
  precachePrerendered: true,
}))
