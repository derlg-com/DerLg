'use client'

import { useEffect, useMemo } from 'react'
import { useApiQuery } from '@/lib/use-api-query'
import { convertFromUsd as convertFromUsdStatic, type Currency } from '@/lib/format'

/**
 * Live currency exchange rates (tasks 28.2 / 28.3, Requirements 44.3, 44.4, 44.8).
 *
 * ## Assumed backend contract
 * `GET /v1/exchange-rates` → USD-base rates, returned inside the standard
 * `{ success, data }` envelope (unwrapped by the api-client):
 *
 * ```json
 * {
 *   "base": "USD",
 *   "rates": { "KHR": 4100, "CNY": 7.2 },
 *   "updatedAt": "2026-05-30T00:00:00.000Z"
 * }
 * ```
 *
 * The backend is expected to cache upstream (ExchangeRate-API) results daily,
 * so a once-per-day client fetch is sufficient. If/when the endpoint differs
 * (e.g. `/v1/currency/rates`), only {@link EXCHANGE_RATES_PATH} needs updating.
 *
 * ## Daily freshness (task 28.3)
 * The query is configured with a ~24h `staleTime`, so consumers mounting within
 * the day reuse the cached value without a network round-trip; the value is
 * refreshed on the next mount/focus after it goes stale.
 *
 * ## Offline fallback (graceful degradation)
 * - Last-fetched rates are persisted to `localStorage` so conversions work
 *   offline / on a cold start before the network responds.
 * - When neither live nor persisted rates are available, callers fall back to
 *   the hardcoded constants in `lib/format.ts` (via {@link convertFromUsd}),
 *   so prices always render — nothing breaks if the endpoint is unavailable.
 */

export interface ExchangeRatesResponse {
  base: string
  rates: Partial<Record<Currency, number>>
  updatedAt?: string
}

export interface ExchangeRatesState {
  /** USD-base multipliers, e.g. `{ KHR: 4100, CNY: 7.2 }`. USD is implicitly 1. */
  rates: Partial<Record<Currency, number>>
  /** ISO timestamp the rates were produced, when known. */
  updatedAt?: string
  /** True while the first network fetch is in flight (and no cache exists). */
  isLoading: boolean
  /** True when `rates` came from the backend (vs. the hardcoded fallback). */
  isLive: boolean
  /**
   * Convert a USD amount to `currency` using live rates when available, else
   * the hardcoded fallback from `lib/format.ts`. Always returns a number.
   */
  convertFromUsd: (amountUsd: number, currency: Currency) => number
}

/** Endpoint for USD-base exchange rates (see contract above). */
export const EXCHANGE_RATES_PATH = '/v1/exchange-rates'

/** ~24h freshness window — rates refresh at most once per day (task 28.3). */
export const EXCHANGE_RATES_STALE_TIME = 24 * 60 * 60 * 1000

/** localStorage key for the last successfully fetched rates (offline fallback). */
export const EXCHANGE_RATES_STORAGE_KEY = 'derlg:exchange-rates'

function readPersisted(): ExchangeRatesResponse | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(EXCHANGE_RATES_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ExchangeRatesResponse
    if (parsed && typeof parsed === 'object' && parsed.rates && typeof parsed.rates === 'object') {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

function persist(data: ExchangeRatesResponse): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(EXCHANGE_RATES_STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Storage full / blocked (private mode) — fine, we just lose offline cache.
  }
}

/**
 * Fetch and expose USD-base exchange rates with daily freshness and an offline
 * fallback. See module docs for the assumed backend contract.
 */
export function useExchangeRates(): ExchangeRatesState {
  const { data, isLoading } = useApiQuery<ExchangeRatesResponse>(EXCHANGE_RATES_PATH, {
    staleTime: EXCHANGE_RATES_STALE_TIME,
    // Daily data — no need to refetch on every focus.
    refetchOnWindowFocus: false,
  })

  // Persist successful responses for offline / cold-start use.
  useEffect(() => {
    if (data && data.rates && typeof data.rates === 'object') {
      persist(data)
    }
  }, [data])

  // Resolve the effective rate source: live → persisted → none.
  const persisted = useMemo(() => (data ? null : readPersisted()), [data])
  const source = data ?? persisted

  const rates = useMemo<Partial<Record<Currency, number>>>(() => source?.rates ?? {}, [source])
  const isLive = Boolean(source)

  const convertFromUsd = useMemo(() => {
    return (amountUsd: number, currency: Currency): number => {
      if (currency === 'USD') return amountUsd
      const rate = rates[currency]
      if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
        return amountUsd * rate
      }
      // Graceful fallback to the hardcoded constants in lib/format.ts.
      return convertFromUsdStatic(amountUsd, currency)
    }
  }, [rates])

  return {
    rates,
    updatedAt: source?.updatedAt,
    isLoading: isLoading && !persisted,
    isLive,
    convertFromUsd,
  }
}
