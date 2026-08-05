import { hasLocale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'

import { defaultLocale, localeTags, type Locale } from './config'
import { routing } from './routing'

/**
 * Per-request i18n configuration consumed by the next-intl plugin.
 *
 * Messages are imported dynamically so each locale is its own chunk; a Khmer
 * visitor never downloads the Chinese catalogue.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale: Locale = hasLocale(routing.locales, requested) ? requested : defaultLocale

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: 'Asia/Phnom_Penh',
    formats: {
      dateTime: {
        short: { day: 'numeric', month: 'short', year: 'numeric' },
        long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
      },
      number: {
        usd: { style: 'currency', currency: 'USD' },
      },
    },
    // Surface missing keys loudly in development, quietly in production: a broken
    // translation should not blank out a booking screen for a real user.
    onError(error) {
      if (process.env.NODE_ENV === 'development') console.error(error)
    },
    getMessageFallback({ key, namespace }) {
      const path = [namespace, key].filter(Boolean).join('.')
      return process.env.NODE_ENV === 'development' ? `⚠️ ${path}` : path.split('.').pop()!
    },
    // Expose the resolved BCP 47 tag for consumers that need it.
    ...({ localeTag: localeTags[locale] } as Record<string, unknown>),
  }
})
