import { describe, it, expect } from 'vitest'
import { PHNOM_PENH } from '@/lib/geo'
import {
  buildExploreMarkers,
  computeBounds,
  computeCenter,
  festivalsToMarkers,
  hasValidCoords,
  pinStyleFor,
  placesToMarkers,
  DEFAULT_PLACE_PIN_STYLE,
  FESTIVAL_PIN_STYLE,
  SELECTED_PIN_STYLE,
  type ExploreMarker,
} from '@/lib/explore-map'
import type { FestivalSummary, PlaceSummary } from '@/types/domain'

function place(over: Partial<PlaceSummary> = {}): PlaceSummary {
  return {
    id: 'p1',
    name: 'Angkor Wat',
    category: 'temple',
    latitude: 13.4125,
    longitude: 103.867,
    entryFeeUsd: 37,
    coverImage: null,
    ...over,
  }
}

function festival(over: Partial<FestivalSummary> = {}): FestivalSummary {
  return {
    id: 'f1',
    name: 'Water Festival',
    startDate: '2026-11-14',
    endDate: '2026-11-16',
    province: 'Phnom Penh',
    location: null,
    coverImage: null,
    ...over,
  }
}

describe('hasValidCoords', () => {
  it('accepts finite in-range coordinates', () => {
    expect(hasValidCoords(13.41, 103.86)).toBe(true)
  })

  it('rejects non-numbers, non-finite, out-of-range, and null island', () => {
    expect(hasValidCoords('13', 103)).toBe(false)
    expect(hasValidCoords(NaN, 1)).toBe(false)
    expect(hasValidCoords(Infinity, 1)).toBe(false)
    expect(hasValidCoords(91, 0)).toBe(false)
    expect(hasValidCoords(0, 181)).toBe(false)
    expect(hasValidCoords(0, 0)).toBe(false)
  })
})

describe('placesToMarkers', () => {
  it('maps places with valid coordinates to kind-prefixed markers', () => {
    const markers = placesToMarkers([place({ id: 'a' }), place({ id: 'b', name: 'Bayon' })])
    expect(markers).toHaveLength(2)
    expect(markers[0]).toMatchObject({
      id: 'place:a',
      kind: 'place',
      entityId: 'a',
      title: 'Angkor Wat',
      category: 'temple',
      entryFeeUsd: 37,
    })
    expect(markers[0].position).toEqual({ lat: 13.4125, lng: 103.867 })
  })

  it('drops places without usable coordinates', () => {
    const markers = placesToMarkers([
      place({ id: 'ok' }),
      place({ id: 'bad', latitude: 0, longitude: 0 }),
    ])
    expect(markers.map((m) => m.entityId)).toEqual(['ok'])
  })
})

describe('festivalsToMarkers', () => {
  it('includes only festivals that carry valid coordinates', () => {
    const withCoords = festival({ id: 'wf' }) as FestivalSummary & {
      latitude: number
      longitude: number
    }
    withCoords.latitude = 11.55
    withCoords.longitude = 104.92
    const markers = festivalsToMarkers([withCoords, festival({ id: 'no-coords' })])
    expect(markers).toHaveLength(1)
    expect(markers[0]).toMatchObject({ id: 'festival:wf', kind: 'festival', entityId: 'wf' })
  })
})

describe('buildExploreMarkers', () => {
  it('combines place and festival markers', () => {
    const wf = festival({ id: 'wf' }) as FestivalSummary & { latitude: number; longitude: number }
    wf.latitude = 11.55
    wf.longitude = 104.92
    const markers = buildExploreMarkers([place({ id: 'a' })], [wf])
    expect(markers.map((m) => m.kind)).toEqual(['place', 'festival'])
  })
})

const M = (lat: number, lng: number, over: Partial<ExploreMarker> = {}): ExploreMarker => ({
  id: `place:${lat},${lng}`,
  kind: 'place',
  entityId: `${lat},${lng}`,
  position: { lat, lng },
  title: 'x',
  ...over,
})

describe('computeBounds', () => {
  it('returns null for an empty set', () => {
    expect(computeBounds([])).toBeNull()
  })

  it('returns the tight bounding box of all markers', () => {
    const bounds = computeBounds([M(10, 100), M(12, 105), M(11, 99)])
    expect(bounds).toEqual({ south: 10, west: 99, north: 12, east: 105 })
  })
})

describe('computeCenter', () => {
  it('defaults to Phnom Penh when empty', () => {
    expect(computeCenter([])).toEqual(PHNOM_PENH)
  })

  it('returns the centroid of the markers', () => {
    expect(computeCenter([M(10, 100), M(12, 104)])).toEqual({ lat: 11, lng: 102 })
  })
})

describe('pinStyleFor', () => {
  it('uses the highlight style when selected, regardless of kind', () => {
    expect(pinStyleFor(M(1, 1, { category: 'temple' }), true)).toEqual(SELECTED_PIN_STYLE)
    expect(pinStyleFor(M(1, 1, { kind: 'festival' }), true)).toEqual(SELECTED_PIN_STYLE)
  })

  it('uses the festival style for festival markers', () => {
    expect(pinStyleFor(M(1, 1, { kind: 'festival' }), false)).toEqual(FESTIVAL_PIN_STYLE)
  })

  it('uses a category-specific style for known place categories', () => {
    const style = pinStyleFor(M(1, 1, { category: 'nature' }), false)
    expect(style).not.toEqual(DEFAULT_PLACE_PIN_STYLE)
    expect(style.background).toBe('#16a34a')
  })

  it('falls back to the default place style for unknown categories', () => {
    expect(pinStyleFor(M(1, 1, { category: 'unmapped' }), false)).toEqual(DEFAULT_PLACE_PIN_STYLE)
    expect(pinStyleFor(M(1, 1, { category: undefined }), false)).toEqual(DEFAULT_PLACE_PIN_STYLE)
  })
})
