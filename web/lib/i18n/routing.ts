import { defineRouting } from 'next-intl/routing'

import { defaultLocale, locales } from './config'

export const routing = defineRouting({
  locales,
  defaultLocale,
  // Always prefix so every URL is unambiguous and shareable: /en/trips, /zh/trips.
  // Without this the default locale would live at an unprefixed path, which makes
  // language-specific share links and cache keys inconsistent.
  localePrefix: 'always',
  localeCookie: {
    // Remember an explicit choice for a year; it is a preference, not a session.
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  },
})
