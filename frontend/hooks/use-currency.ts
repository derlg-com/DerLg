'use client'

import { useLanguageStore, type Locale } from '@/lib/i18n'
import { usePreferencesStore } from '@/stores/preferences.store'
import type { Currency } from '@/types/api'

const LOCALE_DEFAULT_CURRENCY: Record<Locale, Currency> = {
  en: 'USD',
  zh: 'CNY',
  km: 'KHR',
}

/** Effective display currency: explicit preference, else the locale default. */
export function useCurrency(): Currency {
  const locale = useLanguageStore((s) => s.locale)
  const currency = usePreferencesStore((s) => s.currency)
  return currency ?? LOCALE_DEFAULT_CURRENCY[locale]
}
