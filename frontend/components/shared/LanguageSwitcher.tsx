'use client'

import { useEffect, useRef } from 'react'
import { setAcceptLanguage } from '@/lib/api-client'
import { invalidateApiQuery } from '@/lib/use-api-query'
import {
  useLanguageStore,
  getLanguageHtmlAttr,
  initBrowserLocaleDefault,
  useTranslations,
  LOCALES,
  type Locale,
} from '@/lib/i18n'

const LABELS: Record<Locale, string> = {
  en: 'English',
  zh: '中文',
  km: 'ខ្មែរ',
}

export function LanguageSync() {
  const locale = useLanguageStore((s) => s.locale)
  const prevLocale = useRef<Locale | null>(null)
  // First-visit default: adopt the browser language when the user has not yet
  // chosen one (Requirement 13.3). Runs once on mount; a persisted choice wins.
  useEffect(() => {
    initBrowserLocaleDefault()
  }, [])
  useEffect(() => {
    // Mirror the active locale to the API client so the backend localizes
    // catalog content via Accept-Language (Requirement 13.7), and reflect it on
    // the document for assistive tech / typography.
    setAcceptLanguage(locale)
    if (typeof document !== 'undefined') {
      document.documentElement.lang = getLanguageHtmlAttr(locale)
    }
    // When the user actually switches language, drop cached catalog responses so
    // dependent views refetch in the new locale (Requirements 13.4, 13.7). Skip
    // the initial mount — there is nothing localized to invalidate yet.
    if (prevLocale.current !== null && prevLocale.current !== locale) {
      invalidateApiQuery()
    }
    prevLocale.current = locale
  }, [locale])
  return null
}

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const locale = useLanguageStore((s) => s.locale)
  const setLocale = useLanguageStore((s) => s.setLocale)
  const t = useTranslations('shell')

  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      aria-label={t('language')}
      className={`text-xs bg-transparent border border-border rounded-md px-2 py-1 ${className}`}
    >
      {LOCALES.map((l) => (
        <option key={l} value={l}>
          {LABELS[l]}
        </option>
      ))}
    </select>
  )
}
