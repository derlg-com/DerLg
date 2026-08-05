/**
 * Currency and number formatting.
 *
 * The backend quotes every price in USD. KHR and CNY are display conversions, so
 * they are marked approximate in the UI rather than presented as exact quotes.
 */

export const CURRENCIES = ['USD', 'KHR', 'CNY'] as const
export type Currency = (typeof CURRENCIES)[number]

/** Fallback rates, used until a live rate source is wired up. */
export const FALLBACK_RATES: Record<Currency, number> = {
  USD: 1,
  KHR: 4100,
  CNY: 7.1,
}

const FRACTION_DIGITS: Record<Currency, number> = {
  USD: 2,
  // Riel and yuan are quoted without cents in practice.
  KHR: 0,
  CNY: 0,
}

export function convertFromUsd(amountUsd: number, currency: Currency, rate?: number): number {
  return amountUsd * (rate ?? FALLBACK_RATES[currency])
}

export function formatCurrency(
  amount: number,
  currency: Currency,
  locale: string,
  options: { maximumFractionDigits?: number } = {},
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: options.maximumFractionDigits ?? FRACTION_DIGITS[currency],
  }).format(amount)
}

/** Formats a USD amount in the user's chosen display currency. */
export function formatPrice(
  amountUsd: number,
  currency: Currency,
  locale: string,
  rate?: number,
): string {
  return formatCurrency(convertFromUsd(amountUsd, currency, rate), currency, locale)
}

/** "4 days" / "1 day", localised by the caller's message catalogue. */
export function formatCompactNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  )
}

/** Rating shown to one decimal place, or null when there are no ratings yet. */
export function formatRating(
  average: number | null | undefined,
  locale: string,
): string | null {
  if (average === null || average === undefined) return null
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(average)
}
