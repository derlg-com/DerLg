import type { MetadataRoute } from 'next'

// Web app manifest (Requirements 12.1, 12.7).
// Served at /manifest.webmanifest via the Next.js App Router file convention.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'DerLg — Cambodia Travel, Reimagined',
    short_name: 'DerLg',
    description:
      "Cambodia's AI-powered travel platform. Discover, plan, book, and pay in one conversation.",
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#0f172a',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
