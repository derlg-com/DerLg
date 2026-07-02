import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { useState } from 'react'
import { ExploreSearch } from '@/components/explore/ExploreSearch'
import { useDebounce, DEFAULT_DEBOUNCE_MS } from '@/hooks/use-debounce'
import {
  EXPLORE_SEARCH_MIN_LENGTH,
  filterFestivalsByQuery,
  filterPlacesByQuery,
  isExploreQueryActive,
  resolveExploreQuery,
} from '@/types/explore'
import type { FestivalSummary, PlaceSummary } from '@/types/domain'

// Task 8.4 — Explore search (Requirement 4.5). Covers the pure query helpers,
// the shared debounce hook, and the ExploreSearch input (clear button + a11y).

function makePlace(overrides: Partial<PlaceSummary> = {}): PlaceSummary {
  return {
    id: 'p1',
    name: 'Angkor Wat',
    category: 'temple',
    latitude: 0,
    longitude: 0,
    entryFeeUsd: 37,
    coverImage: null,
    ...overrides,
  }
}

function makeFestival(overrides: Partial<FestivalSummary> = {}): FestivalSummary {
  return {
    id: 'f1',
    name: 'Water Festival',
    startDate: '2026-11-14',
    endDate: '2026-11-16',
    province: 'Phnom Penh',
    location: 'Riverside',
    coverImage: null,
    ...overrides,
  }
}

describe('resolveExploreQuery / isExploreQueryActive', () => {
  it('trims and treats blank/missing input as no query', () => {
    expect(resolveExploreQuery(null)).toBe('')
    expect(resolveExploreQuery(undefined)).toBe('')
    expect(resolveExploreQuery('   ')).toBe('')
    expect(resolveExploreQuery('  angkor ')).toBe('angkor')
  })

  it('flags queries at or above the min length as active', () => {
    expect(isExploreQueryActive('')).toBe(false)
    expect(isExploreQueryActive('   ')).toBe(false)
    expect(isExploreQueryActive('a')).toBe(EXPLORE_SEARCH_MIN_LENGTH <= 1)
    expect(isExploreQueryActive('angkor')).toBe(true)
  })
})

describe('filterPlacesByQuery', () => {
  const places = [
    makePlace({ id: 'a', name: 'Angkor Wat' }),
    makePlace({ id: 'b', name: 'Bayon Temple' }),
    makePlace({ id: 'c', name: 'Royal Palace' }),
  ]

  it('returns the list unchanged for a blank query', () => {
    expect(filterPlacesByQuery(places, '')).toEqual(places)
    expect(filterPlacesByQuery(places, '   ')).toEqual(places)
  })

  it('matches name case-insensitively as a substring', () => {
    expect(filterPlacesByQuery(places, 'temple').map((p) => p.id)).toEqual(['b'])
    expect(filterPlacesByQuery(places, 'ANGKOR').map((p) => p.id)).toEqual(['a'])
    expect(filterPlacesByQuery(places, 'a').map((p) => p.id)).toEqual(['a', 'b', 'c'])
  })

  it('returns an empty list when nothing matches and never mutates input', () => {
    expect(filterPlacesByQuery(places, 'zzz')).toEqual([])
    expect(places).toHaveLength(3)
  })
})

describe('filterFestivalsByQuery', () => {
  const festivals = [
    makeFestival({ id: 'a', name: 'Water Festival', province: 'Phnom Penh' }),
    makeFestival({ id: 'b', name: 'Angkor Sankranta', province: 'Siem Reap', location: 'Angkor' }),
    makeFestival({ id: 'c', name: 'Sea Festival', province: 'Kep', location: 'Beach' }),
  ]

  it('returns the list unchanged for a blank query', () => {
    expect(filterFestivalsByQuery(festivals, '')).toEqual(festivals)
  })

  it('matches name, province, or location case-insensitively', () => {
    expect(filterFestivalsByQuery(festivals, 'water').map((f) => f.id)).toEqual(['a'])
    expect(filterFestivalsByQuery(festivals, 'siem').map((f) => f.id)).toEqual(['b'])
    expect(filterFestivalsByQuery(festivals, 'beach').map((f) => f.id)).toEqual(['c'])
  })

  it('tolerates null province/location', () => {
    const f = [makeFestival({ id: 'x', name: 'Lonely', province: null, location: null })]
    expect(filterFestivalsByQuery(f, 'lonely').map((x) => x.id)).toEqual(['x'])
    expect(filterFestivalsByQuery(f, 'nope')).toEqual([])
  })
})

describe('useDebounce', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('only updates after the delay elapses and collapses rapid changes', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'a' },
    })

    expect(result.current).toBe('a')

    rerender({ value: 'ab' })
    rerender({ value: 'abc' })
    expect(result.current).toBe('a') // not yet flushed

    act(() => {
      vi.advanceTimersByTime(299)
    })
    expect(result.current).toBe('a')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe('abc') // collapsed to the latest value
  })

  it('defaults to the shared 300ms delay', () => {
    expect(DEFAULT_DEBOUNCE_MS).toBe(300)
  })
})

describe('ExploreSearch', () => {
  function Harness({ initial = '' }: { initial?: string }) {
    const [value, setValue] = useState(initial)
    return (
      <ExploreSearch
        value={value}
        onChange={setValue}
        label="Search places"
        placeholder="Search places"
      />
    )
  }

  it('renders an accessible search input with the given placeholder', () => {
    render(<Harness />)
    const input = screen.getByLabelText('Search places')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('placeholder', 'Search places')
  })

  it('does not show the clear button when empty', () => {
    render(<Harness />)
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()
  })

  it('shows a clear button when there is text and clears on click', () => {
    render(<Harness initial="angkor" />)
    const input = screen.getByLabelText('Search places') as HTMLInputElement
    expect(input.value).toBe('angkor')

    const clear = screen.getByRole('button', { name: 'Clear search' })
    fireEvent.click(clear)

    expect((screen.getByLabelText('Search places') as HTMLInputElement).value).toBe('')
  })

  it('emits typed input through onChange', () => {
    render(<Harness />)
    const input = screen.getByLabelText('Search places') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'bayon' } })
    expect(input.value).toBe('bayon')
  })
})
