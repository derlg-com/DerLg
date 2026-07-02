'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import enMessages from '@/messages/en.json'
import zhMessages from '@/messages/zh.json'
import kmMessages from '@/messages/km.json'

export type Locale = 'en' | 'zh' | 'km'

export const LOCALES: Locale[] = ['en', 'zh', 'km']
export const DEFAULT_LOCALE: Locale = 'en'

/** localStorage key the language store persists to (zustand `persist` name). */
export const LANGUAGE_STORAGE_KEY = 'derlg:language'

type Messages = typeof enMessages

const MESSAGE_BUNDLES: Record<Locale, Messages> = {
  en: enMessages,
  zh: zhMessages,
  km: kmMessages,
}

/**
 * Map a browser language tag (e.g. `zh-CN`, `km`, `en-US`) to a supported
 * {@link Locale}, falling back to {@link DEFAULT_LOCALE} when unsupported.
 *
 * Used to seed the default language from the user's browser on their first
 * visit (Requirement 13.3) before any choice has been persisted.
 */
export function resolveBrowserLocale(languages: readonly string[] | undefined): Locale {
  if (!languages) return DEFAULT_LOCALE
  for (const tag of languages) {
    const primary = tag.toLowerCase().split('-')[0]
    if ((LOCALES as string[]).includes(primary)) {
      return primary as Locale
    }
  }
  return DEFAULT_LOCALE
}

/** Read the browser's preferred languages (SSR-safe; returns the default off-DOM). */
export function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE
  const languages =
    navigator.languages && navigator.languages.length > 0
      ? navigator.languages
      : navigator.language
        ? [navigator.language]
        : undefined
  return resolveBrowserLocale(languages)
}

/** `true` when the user has previously persisted a language choice. */
function hasPersistedLocale(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) !== null
  } catch {
    // localStorage can throw (private mode / blocked). Treat as "no choice".
    return false
  }
}

/**
 * Seed the active locale from the browser language on first visit only
 * (Requirement 13.3). If the user has already persisted a choice
 * (Requirement 13.5) this is a no-op, so an explicit selection always wins.
 *
 * Safe to call multiple times; idempotent after the first persisted choice.
 * Returns the locale that is now active.
 */
export function initBrowserLocaleDefault(): Locale {
  if (hasPersistedLocale()) {
    return useLanguageStore.getState().locale
  }
  const detected = detectBrowserLocale()
  useLanguageStore.getState().setLocale(detected)
  return detected
}

interface LanguageState {
  locale: Locale
  setLocale: (locale: Locale) => void
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      locale: DEFAULT_LOCALE,
      setLocale: (locale) => set({ locale }),
    }),
    { name: LANGUAGE_STORAGE_KEY },
  ),
)

function getMessage(messages: unknown, path: string): string | undefined {
  const segments = path.split('.')
  let cursor: unknown = messages
  for (const seg of segments) {
    if (cursor && typeof cursor === 'object' && seg in (cursor as Record<string, unknown>)) {
      cursor = (cursor as Record<string, unknown>)[seg]
    } else {
      return undefined
    }
  }
  return typeof cursor === 'string' ? cursor : undefined
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, key) => (key in vars ? String(vars[key]) : `{${key}}`))
}

/**
 * Translate a dotted message key against the active locale, falling back to English.
 * Supports `{name}` interpolation.
 */
export function useTranslations(namespace?: string) {
  const locale = useLanguageStore((s) => s.locale)
  const messages = MESSAGE_BUNDLES[locale] ?? MESSAGE_BUNDLES.en
  const fallback = MESSAGE_BUNDLES.en

  return (key: string, vars?: Record<string, string | number>, fallbackKey?: string): string => {
    const fullKey = namespace ? `${namespace}.${key}` : key
    let found = getMessage(messages, fullKey) ?? getMessage(fallback, fullKey)
    if (found === undefined && fallbackKey) {
      const fbKey = namespace ? `${namespace}.${fallbackKey}` : fallbackKey
      found = getMessage(messages, fbKey) ?? getMessage(fallback, fbKey)
    }
    return interpolate(found ?? fullKey, vars)
  }
}

export function getLanguageHtmlAttr(locale: Locale): string {
  return locale === 'zh' ? 'zh-CN' : locale === 'km' ? 'km-KH' : 'en-US'
}

export function languageStoreToWsLang(locale: Locale): 'EN' | 'ZH' | 'KM' {
  return locale === 'zh' ? 'ZH' : locale === 'km' ? 'KM' : 'EN'
}
