import { describe, it, expect } from 'vitest'
import { countdownTo, isUpcomingFestival } from '@/lib/festival-countdown'
import {
  resolveFestivalType,
  filterFestivalsByType,
  FESTIVAL_TYPE_CLASSES,
  FESTIVAL_TYPES,
} from '@/types/explore'
import type { FestivalSummary } from '@/types/domain'

const now = new Date('2026-01-01T00:00:00Z')

function festival(partial: Partial<FestivalSummary>): FestivalSummary {
  return {
    id: 'f1',
    name: 'Test',
    startDate: '2026-02-01',
    endDate: '2026-02-03',
    province: null,
    location: null,
    coverImage: null,
    ...partial,
  }
}

describe('countdownTo', () => {
  it('computes whole days and hours until a future date', () => {
    const r = countdownTo('2026-01-03T06:00:00Z', now)
    expect(r.isPast).toBe(false)
    expect(r.days).toBe(2)
    expect(r.hours).toBe(6)
    expect(r.totalMs).toBeGreaterThan(0)
  })

  it('treats past dates as past with zeroed parts', () => {
    const r = countdownTo('2025-12-31T00:00:00Z', now)
    expect(r).toEqual({ days: 0, hours: 0, totalMs: 0, isPast: true })
  })

  it('treats the exact instant as past (non-negative)', () => {
    const r = countdownTo('2026-01-01T00:00:00Z', now)
    expect(r.isPast).toBe(true)
  })

  it('returns isPast for malformed dates rather than throwing', () => {
    const r = countdownTo('not-a-date', now)
    expect(r.isPast).toBe(true)
  })
})

describe('isUpcomingFestival', () => {
  it('is true for future starts and false for past ones', () => {
    expect(isUpcomingFestival('2026-06-01', now)).toBe(true)
    expect(isUpcomingFestival('2025-01-01', now)).toBe(false)
  })
})

describe('resolveFestivalType', () => {
  it('normalizes known types (case-insensitive)', () => {
    expect(resolveFestivalType('Religious')).toBe('religious')
    expect(resolveFestivalType('FOOD')).toBe('food')
  })

  it('buckets missing/unknown values as other', () => {
    expect(resolveFestivalType(null)).toBe('other')
    expect(resolveFestivalType(undefined)).toBe('other')
    expect(resolveFestivalType('parade')).toBe('other')
  })

  it('has a color class for every type', () => {
    for (const type of FESTIVAL_TYPES) {
      expect(FESTIVAL_TYPE_CLASSES[type]).toBeTruthy()
    }
  })
})

describe('filterFestivalsByType', () => {
  const items = [
    festival({ id: 'a', type: 'religious' }),
    festival({ id: 'b', type: 'music' }),
    festival({ id: 'c', type: null }),
    festival({ id: 'd', type: 'unknown-thing' }),
  ]

  it('returns everything for a null filter', () => {
    expect(filterFestivalsByType(items, null)).toHaveLength(4)
  })

  it('filters by an explicit type', () => {
    expect(filterFestivalsByType(items, 'music').map((f) => f.id)).toEqual(['b'])
  })

  it('groups null + unrecognized under other', () => {
    expect(filterFestivalsByType(items, 'other').map((f) => f.id)).toEqual(['c', 'd'])
  })
})
