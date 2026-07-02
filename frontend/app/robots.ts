import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site-url'

/**
 * robots.txt (Task 30.3 — Section 30 SEO).
 *
 * Allows crawling of public content while disallowing authenticated,
 * transactional, and internal areas. References the sitemap so crawlers can
 * discover the public routes listed in `app/sitemap.ts`.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl()
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/login',
          '/register',
          '/forgot-password',
          '/reset-password',
          '/profile',
          '/profile/',
          '/checkout',
          '/checkout/',
          '/bookings',
          '/bookings/',
          '/vibe-booking',
          '/api/',
          '/ui-kit',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
