'use client'

import { Select } from '@/components/ui/select'
import { usePreferencesStore } from '@/stores/preferences.store'
import { useCurrency } from '@/hooks/use-currency'
import type { Currency } from '@/types/api'

const CURRENCIES: Currency[] = ['USD', 'KHR', 'CNY']

export function CurrencySelector({ className }: { className?: string }) {
  const setCurrency = usePreferencesStore((s) => s.setCurrency)
  const current = useCurrency()
  return (
    <Select
      value={current}
      onChange={(e) => setCurrency(e.target.value as Currency)}
      aria-label="Currency"
      className={className}
    >
      {CURRENCIES.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </Select>
  )
}
