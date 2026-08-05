/**
 * Locale configuration shared by the routing layer, the API client and the
 * WebSocket handshake.
 *
 * Three independent systems each want the locale in a different shape:
 *  - next-intl routes use the short code (`en` | `zh` | `km`)
 *  - the NestJS backend reads `Accept-Language` and parses a BCP 47 tag
 *  - the Python agent expects an uppercase enum where Khmer is `KH`, not `KM`
 * Keeping the mappings here stops those conversions being re-invented per call.
 */

export const locales = ['en', 'zh', 'km'] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'

/** Cookie next-intl uses to remember an explicit language choice. */
export const LOCALE_COOKIE = 'NEXT_LOCALE'

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value)
}

/** Native language names, shown in the switcher so users find their own. */
export const localeLabels: Record<Locale, string> = {
  en: 'English',
  zh: '中文',
  km: 'ខ្មែរ',
}

/** BCP 47 tags for `Accept-Language` and `Intl.*` formatting. */
export const localeTags: Record<Locale, string> = {
  en: 'en-US',
  zh: 'zh-CN',
  km: 'km-KH',
}

/**
 * Language codes the Vibe Booking agent accepts in its `auth` frame.
 * The agent normalises `KM` to `KH` internally, but sending the value it stores
 * avoids relying on that alias.
 */
export const agentLanguages: Record<Locale, 'EN' | 'ZH' | 'KH'> = {
  en: 'EN',
  zh: 'ZH',
  km: 'KH',
}

export function toAcceptLanguage(locale: Locale): string {
  // Weighted so the backend falls back to English rather than an arbitrary match.
  const tag = localeTags[locale]
  return locale === defaultLocale ? tag : `${tag},${localeTags[defaultLocale]};q=0.8`
}

export function toAgentLanguage(locale: Locale): 'EN' | 'ZH' | 'KH' {
  return agentLanguages[locale]
}
