import createMiddleware from 'next-intl/middleware'

import { routing } from './lib/i18n/routing'

/**
 * Locale negotiation proxy (the Next 16 rename of `middleware`).
 *
 * Resolves the active locale from the URL prefix, then the `NEXT_LOCALE` cookie,
 * then the `Accept-Language` header, and redirects unprefixed paths to the
 * resolved locale.
 */
const handle = createMiddleware(routing)

export default handle

export const config = {
  /*
   * Page routes only. Explicitly excluded:
   *  - /api        BFF route handlers must not be locale-prefixed
   *  - /_next      framework assets
   *  - /_vercel    platform internals
   *  - anything with a file extension (icons, manifest, images, sw.js)
   */
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
