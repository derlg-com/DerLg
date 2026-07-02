'use client'

import { useCallback } from 'react'
import { useLanguageStore } from '@/lib/i18n'
import { formatCurrency, type Currency } from '@/lib/format'
import { useCurrency } from '@/hooks/use-currency'
import { useExchangeRates } from '@/hooks/use-exchange-rates'

export interface FormatCurrencyHook {
  /** Effective display currency (explicit preference, else locale default). */
  currency: Currency
  /** True when conversions use live backend rates (vs. hardcoded fallback). */
  isLive: boolean
  /** ISO timestamp of the active rate set, when known. */
  updatedAt?: string
  /**
   * Format a USD amount in the user's chosen currency, using live backend rates
   * when available and falling back to the hardcoded `lib/format.ts` rates
   * otherwise. Pass `currencyOverride` to force a specific currency (e.g. always
   * showing the original USD alongside the converted value).
   */
  format: (amountUsd: number, currencyOverride?: Currency) => string
  /** Convenience: always format in USD (the canonical charge currency). */
  formatUsd: (amountUsd: number) => string
}

/**
 * Currency formatting that overlays **live** backend exchange rates on top of
 * the project's pure `formatCurrency` (tasks 28.2 / Requirements 44.3–44.5,
 * 44.9).
 *
 * Locale-aware formatting is already handled by `Intl` inside `formatCurrency`;
 * this hook only swaps the USD→currency conversion for live rates from
 * {@link useExchangeRates}, keeping `lib/format.ts` as the offline fallback so
 * nothing breaks when the rates endpoint is unavailable.
 *
 * Prefer this hook over calling `formatCurrency` directly on price-display
 * surfaces (cards, summaries) so users see up-to-date conversions.
 */
export function useFormatCurrency(): FormatCurrencyHook {
  const locale = useLanguageStore((s) => s.locale)
  const currency = useCurrency()
  const { convertFromUsd, isLive, updatedAt } = useExchangeRates()

  const format = useCallback(
    (amountUsd: number, currencyOverride?: Currency) =>
      formatCurrency(amountUsd, locale, currencyOverride ?? currency, {
        convert: convertFromUsd,
      }),
    [locale, currency, convertFromUsd],
  )

  const formatUsd = useCallback(
    (amountUsd: number) => formatCurrency(amountUsd, locale, 'USD', { convert: convertFromUsd }),
    [locale, convertFromUsd],
  )

  return { currency, isLive, updatedAt, format, formatUsd }
}
