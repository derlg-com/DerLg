import type { Locale } from './i18n';

const KHR_PER_USD = 4100;
const CNY_PER_USD = 7.2;

export type Currency = 'USD' | 'KHR' | 'CNY';

const LOCALE_TO_CURRENCY: Record<Locale, Currency> = {
  en: 'USD',
  zh: 'CNY',
  km: 'KHR',
};

const LOCALE_TO_BCP47: Record<Locale, string> = {
  en: 'en-US',
  zh: 'zh-CN',
  km: 'km-KH',
};

export function convertFromUsd(amountUsd: number, currency: Currency): number {
  switch (currency) {
    case 'USD':
      return amountUsd;
    case 'KHR':
      return amountUsd * KHR_PER_USD;
    case 'CNY':
      return amountUsd * CNY_PER_USD;
  }
}

export function formatCurrency(
  amountUsd: number,
  locale: Locale,
  currencyOverride?: Currency,
): string {
  const currency = currencyOverride ?? LOCALE_TO_CURRENCY[locale];
  const bcp47 = LOCALE_TO_BCP47[locale];
  const value = convertFromUsd(amountUsd, currency);

  const fractionDigits = currency === 'USD' ? 2 : 0;

  return new Intl.NumberFormat(bcp47, {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatDate(
  dateIso: string | Date,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = typeof dateIso === 'string' ? new Date(dateIso) : dateIso;
  const bcp47 = LOCALE_TO_BCP47[locale];

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };

  return new Intl.DateTimeFormat(bcp47, options ?? defaultOptions).format(date);
}

export function formatDateShort(dateIso: string | Date, locale: Locale): string {
  return formatDate(dateIso, locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatWeekday(dateIso: string | Date, locale: Locale): string {
  return formatDate(dateIso, locale, { weekday: 'short' });
}

export function formatTime(dateIso: string | Date, locale: Locale): string {
  return formatDate(dateIso, locale, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDateTime(dateIso: string | Date, locale: Locale): string {
  return formatDate(dateIso, locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
