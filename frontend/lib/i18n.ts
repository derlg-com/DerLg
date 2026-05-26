'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import enMessages from '@/messages/en.json'
import zhMessages from '@/messages/zh.json'
import kmMessages from '@/messages/km.json'

export type Locale = 'en' | 'zh' | 'km'

export const LOCALES: Locale[] = ['en', 'zh', 'km']
export const DEFAULT_LOCALE: Locale = 'en'

type Messages = typeof enMessages

const MESSAGE_BUNDLES: Record<Locale, Messages> = {
  en: enMessages,
  zh: zhMessages,
  km: kmMessages,
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
    { name: 'derlg:language' },
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
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  )
}

/**
 * Translate a dotted message key against the active locale, falling back to English.
 * Supports `{name}` interpolation.
 */
export function useTranslations(namespace?: string) {
  const locale = useLanguageStore((s) => s.locale)
  const messages = MESSAGE_BUNDLES[locale] ?? MESSAGE_BUNDLES.en
  const fallback = MESSAGE_BUNDLES.en

  return (key: string, vars?: Record<string, string | number>): string => {
    const fullKey = namespace ? `${namespace}.${key}` : key
    const found = getMessage(messages, fullKey) ?? getMessage(fallback, fullKey) ?? fullKey
    return interpolate(found, vars)
  }
}

export function getLanguageHtmlAttr(locale: Locale): string {
  return locale === 'zh' ? 'zh-CN' : locale === 'km' ? 'km-KH' : 'en-US'
}

export function languageStoreToWsLang(locale: Locale): 'EN' | 'ZH' | 'KH' {
  return locale === 'zh' ? 'ZH' : locale === 'km' ? 'KH' : 'EN'
}
