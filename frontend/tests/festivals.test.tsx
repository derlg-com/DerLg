import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FestivalGrid } from '@/components/explore/FestivalGrid'
import { FestivalFilters } from '@/components/explore/FestivalFilters'
import {
  FESTIVAL_TIME_FILTERS,
  festivalInMonth,
  festivalInProvince,
  festivalProvinces,
  filterFestivals,
  resolveFestivalMonth,
  resolveFestivalProvince,
  resolveFestivalTime,
} from '@/types/explore'
import type { FestivalSummary } from '@/types/domain'

// Task 8.3 — Explore → Festivals tab. Covers the pure filter logic (time/month/
// province resolution + client-side month/province filtering) and the
// FestivalGrid / FestivalFilters rendering (loading / error / empty states,
// time chips, month + province selects).
//
// Validates: Requirements 4.3 (festivals + date/location filtering),
// 4.7/4.8 (filter selection drives the displayed results), 4.9 (list rendering).

function makeFestival(overrides: Partial<FestivalSummary> = {}): FestivalSummary {
  return {
    id: 'f1',
    name: 'Water Festival',
    startDate: '2026-11-14',
    endDate: '2026-11-16',
    province: 'Phnom Penh',
    location: 'Riverside, Phnom Penh',
    coverImage: null,
    ...overrides,
  }
}

describe('festival filter resolvers', () => {
  it('resolveFestivalTime falls back to "upcoming" for unknown values', () => {
    for (const time of FESTIVAL_TIME_FILTERS) {
      expect(resolveFestivalTime(time)).toBe(time)
    }
    expect(resolveFestivalTime(null)).toBe('upcoming')
    expect(resolveFestivalTime('')).toBe('upcoming')
    expect(resolveFestivalTime('whenever')).toBe('upcoming')
  })

  it('resolveFestivalMonth accepts 1–12 and rejects everything else', () => {
    for (let m = 1; m <= 12; m++) {
      expect(resolveFestivalMonth(String(m))).toBe(m)
    }
    expect(resolveFestivalMonth(null)).toBeNull()
    expect(resolveFestivalMonth('')).toBeNull()
    expect(resolveFestivalMonth('all')).toBeNull()
    expect(resolveFestivalMonth('0')).toBeNull()
    expect(resolveFestivalMonth('13')).toBeNull()
    expect(resolveFestivalMonth('3.5')).toBeNull()
    expect(resolveFestivalMonth('abc')).toBeNull()
  })

  it('resolveFestivalProvince trims and treats blanks as null', () => {
    expect(resolveFestivalProvince('Siem Reap')).toBe('Siem Reap')
    expect(resolveFestivalProvince('  Kampot  ')).toBe('Kampot')
    expect(resolveFestivalProvince(null)).toBeNull()
    expect(resolveFestivalProvince('')).toBeNull()
    expect(resolveFestivalProvince('   ')).toBeNull()
  })
})

describe('festivalInMonth', () => {
  it('matches the start month, the end month, and spanned months', () => {
    const f = makeFestival({ startDate: '2026-11-14', endDate: '2026-11-16' })
    expect(festivalInMonth(f, 11)).toBe(true)
    expect(festivalInMonth(f, 10)).toBe(false)
    expect(festivalInMonth(f, 12)).toBe(false)
  })

  it('matches every month a multi-month range overlaps', () => {
    const f = makeFestival({ startDate: '2026-10-28', endDate: '2026-12-02' })
    expect(festivalInMonth(f, 10)).toBe(true)
    expect(festivalInMonth(f, 11)).toBe(true)
    expect(festivalInMonth(f, 12)).toBe(true)
    expect(festivalInMonth(f, 9)).toBe(false)
  })

  it('handles a year-boundary span (Dec → Jan)', () => {
    const f = makeFestival({ startDate: '2026-12-30', endDate: '2027-01-02' })
    expect(festivalInMonth(f, 12)).toBe(true)
    expect(festivalInMonth(f, 1)).toBe(true)
    expect(festivalInMonth(f, 6)).toBe(false)
  })

  it('returns false for malformed or inverted date ranges', () => {
    expect(festivalInMonth(makeFestival({ startDate: 'nope', endDate: 'nope' }), 1)).toBe(false)
    expect(
      festivalInMonth(makeFestival({ startDate: '2026-05-10', endDate: '2026-05-01' }), 5),
    ).toBe(false)
  })
})

describe('festivalInProvince', () => {
  it('matches province first, then location, case-insensitively', () => {
    const f = makeFestival({ province: 'Phnom Penh', location: 'Riverside' })
    expect(festivalInProvince(f, 'Phnom Penh')).toBe(true)
    expect(festivalInProvince(f, 'phnom penh')).toBe(true)
    expect(festivalInProvince(f, 'Siem Reap')).toBe(false)
  })

  it('falls back to location when province is null', () => {
    const f = makeFestival({ province: null, location: 'Battambang' })
    expect(festivalInProvince(f, 'Battambang')).toBe(true)
  })

  it('a null filter matches everything', () => {
    expect(festivalInProvince(makeFestival(), null)).toBe(true)
  })
})

describe('festivalProvinces', () => {
  it('returns distinct, sorted province labels (province preferred over location)', () => {
    const list = [
      makeFestival({ id: 'a', province: 'Siem Reap' }),
      makeFestival({ id: 'b', province: 'Phnom Penh' }),
      makeFestival({ id: 'c', province: 'Siem Reap' }),
      makeFestival({ id: 'd', province: null, location: 'Kampot' }),
    ]
    expect(festivalProvinces(list)).toEqual(['Kampot', 'Phnom Penh', 'Siem Reap'])
  })

  it('ignores blank labels', () => {
    const list = [makeFestival({ province: '   ', location: null })]
    expect(festivalProvinces(list)).toEqual([])
  })
})

describe('filterFestivals', () => {
  const nov = makeFestival({
    id: 'nov',
    startDate: '2026-11-14',
    endDate: '2026-11-16',
    province: 'Phnom Penh',
  })
  const apr = makeFestival({
    id: 'apr',
    startDate: '2026-04-14',
    endDate: '2026-04-16',
    province: 'Nationwide',
  })
  const list = [nov, apr]

  it('returns the list unchanged when no filters are set', () => {
    expect(filterFestivals(list, { month: null, province: null })).toEqual(list)
  })

  it('filters by month', () => {
    expect(filterFestivals(list, { month: 11, province: null }).map((f) => f.id)).toEqual(['nov'])
  })

  it('filters by province', () => {
    expect(filterFestivals(list, { month: null, province: 'Nationwide' }).map((f) => f.id)).toEqual(
      ['apr'],
    )
  })

  it('combines month and province (AND semantics)', () => {
    expect(filterFestivals(list, { month: 11, province: 'Nationwide' })).toEqual([])
    expect(filterFestivals(list, { month: 4, province: 'Nationwide' }).map((f) => f.id)).toEqual([
      'apr',
    ])
  })

  it('never mutates the input', () => {
    filterFestivals(list, { month: 11, province: null })
    expect(list).toHaveLength(2)
  })
})

describe('FestivalGrid', () => {
  it('shows the empty state when there are no festivals', () => {
    render(<FestivalGrid festivals={[]} />)
    expect(screen.getByText('No festivals found')).toBeInTheDocument()
  })

  it('shows the error state when isError is set', () => {
    render(<FestivalGrid festivals={[]} isError />)
    expect(screen.getByText("Couldn't load festivals")).toBeInTheDocument()
  })

  it('renders a card per festival linking to /festivals/<id>', () => {
    render(
      <FestivalGrid
        festivals={[
          makeFestival({ id: 'a', name: 'Festival A' }),
          makeFestival({ id: 'b', name: 'Festival B' }),
        ]}
      />,
    )
    expect(screen.getByText('Festival A')).toBeInTheDocument()
    expect(screen.getByText('Festival B')).toBeInTheDocument()
    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAttribute('href', '/festivals/a')
  })
})

describe('FestivalFilters', () => {
  const noop = () => {}

  it('renders time chips with the active one pressed', () => {
    render(
      <FestivalFilters
        time="all"
        month={null}
        province={null}
        provinces={[]}
        onTimeChange={noop}
        onMonthChange={noop}
        onProvinceChange={noop}
      />,
    )
    expect(screen.getByRole('button', { name: 'All festivals' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Upcoming' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('renders month and province selects and disables province when empty', () => {
    render(
      <FestivalFilters
        time="upcoming"
        month={null}
        province={null}
        provinces={[]}
        onTimeChange={noop}
        onMonthChange={noop}
        onProvinceChange={noop}
      />,
    )
    expect(screen.getByLabelText('Filter festivals by month')).toBeInTheDocument()
    const provinceSelect = screen.getByLabelText('Filter festivals by location')
    expect(provinceSelect).toBeDisabled()
  })

  it('lists the provided provinces as options', () => {
    render(
      <FestivalFilters
        time="upcoming"
        month={null}
        province={null}
        provinces={['Phnom Penh', 'Siem Reap']}
        onTimeChange={noop}
        onMonthChange={noop}
        onProvinceChange={noop}
      />,
    )
    const provinceSelect = screen.getByLabelText('Filter festivals by location')
    expect(provinceSelect).not.toBeDisabled()
    expect(screen.getByRole('option', { name: 'Phnom Penh' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Siem Reap' })).toBeInTheDocument()
  })
})
