import { describe, it, expect } from 'vitest'
import { formatCurrency } from '@/lib/format'

describe('formatCurrency convert override', () => {
  it('uses the injected converter for live rates', () => {
    // Live rate of 4000 KHR/USD instead of the hardcoded 4100.
    const result = formatCurrency(1, 'km', 'KHR', {
      convert: (usd, currency) => (currency === 'KHR' ? usd * 4000 : usd),
    })
    expect(result).toMatch(/4[,.]?\s?000/)
  })

  it('falls back to hardcoded conversion when no override given', () => {
    expect(formatCurrency(1, 'en', 'KHR')).toMatch(/4[,.]?\s?100/)
  })
})
