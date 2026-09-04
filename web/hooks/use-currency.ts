'use client'

import * as React from 'react'

import {
  getCurrencySnapshot,
  getServerCurrencySnapshot,
  setCurrency,
  subscribeToCurrency,
} from '@/lib/currency'
import type { Currency } from '@/lib/format'

/** Reads and writes the display-currency preference. */
export function useCurrency(): { currency: Currency; setCurrency: (next: Currency) => void } {
  const currency = React.useSyncExternalStore(
    subscribeToCurrency,
    getCurrencySnapshot,
    getServerCurrencySnapshot,
  )

  return { currency, setCurrency }
}
