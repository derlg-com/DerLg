/**
 * Display-currency preference as an external store.
 *
 * Prices are always quoted in USD by the backend; this only affects display.
 * Kept outside React (same pattern as lib/theme.ts) so `useSyncExternalStore`
 * can read it without a setState-in-effect cascade.
 */
import { CURRENCIES, type Currency } from '@/lib/format'

export const CURRENCY_STORAGE_KEY = 'derlg-currency'

const listeners = new Set<() => void>()

function isCurrency(value: unknown): value is Currency {
  return typeof value === 'string' && (CURRENCIES as readonly string[]).includes(value)
}

let snapshot: Currency | null = null

function read(): Currency {
  if (typeof localStorage === 'undefined') return 'USD'
  const stored = localStorage.getItem(CURRENCY_STORAGE_KEY)
  return isCurrency(stored) ? stored : 'USD'
}

export function getCurrencySnapshot(): Currency {
  snapshot ??= read()
  return snapshot
}

export function getServerCurrencySnapshot(): Currency {
  return 'USD'
}

export function setCurrency(currency: Currency): void {
  snapshot = currency
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(CURRENCY_STORAGE_KEY, currency)
  }
  listeners.forEach((listener) => listener())
}

export function subscribeToCurrency(listener: () => void): () => void {
  listeners.add(listener)

  const onStorage = (event: StorageEvent) => {
    if (event.key !== CURRENCY_STORAGE_KEY) return
    snapshot = isCurrency(event.newValue) ? event.newValue : 'USD'
    listeners.forEach((l) => l())
  }
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage)

  return () => {
    listeners.delete(listener)
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
  }
}

/** Reset hook for tests. */
export function resetCurrencyStoreForTests(): void {
  snapshot = null
  listeners.clear()
}
