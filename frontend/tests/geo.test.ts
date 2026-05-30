import { describe, it, expect } from 'vitest'
import { haversineKm, PHNOM_PENH } from '@/lib/geo'

describe('lib/geo haversineKm', () => {
  it('is zero for identical points', () => {
    expect(haversineKm(PHNOM_PENH, PHNOM_PENH)).toBe(0)
  })

  it('computes Phnom Penh -> Siem Reap ~ 230km', () => {
    const siemReap = { lat: 13.3671, lng: 103.8448 }
    const km = haversineKm(PHNOM_PENH, siemReap)
    expect(km).toBeGreaterThan(200)
    expect(km).toBeLessThan(260)
  })

  it('is symmetric', () => {
    const a = { lat: 10.6104, lng: 103.5296 }
    expect(haversineKm(PHNOM_PENH, a)).toBeCloseTo(haversineKm(a, PHNOM_PENH), 6)
  })
})
