'use client'

import { useEffect } from 'react'
import { useLanguageStore, getLanguageHtmlAttr, LOCALES, type Locale } from '@/lib/i18n'

const LABELS: Record<Locale, string> = {
  en: 'English',
  zh: '中文',
  km: 'ខ្មែរ',
}

export function LanguageSync() {
  const locale = useLanguageStore((s) => s.locale)
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.lang = getLanguageHtmlAttr(locale)
  }, [locale])
  return null
}

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const locale = useLanguageStore((s) => s.locale)
  const setLocale = useLanguageStore((s) => s.setLocale)

  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      aria-label="Language"
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
