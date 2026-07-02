import { describe, it, expect, beforeEach } from 'vitest'
import {
  OFFLINE_MAP_CACHE_KEY,
  OFFLINE_MAP_CACHE_VERSION,
  OFFLINE_MAP_MAX_MARKERS,
  clearOfflineMapMarkers,
  loadOfflineMapMarkers,
  saveOfflineMapMarkers,
} from '@/lib/offline-map-cache'
import type { ExploreMarker } from '@/lib/explore-map'

function marker(over: Partial<ExploreMarker> = {}): ExploreMarker {
  return {
    id: 'place:p1',
    kind: 'place',
    entityId: 'p1',
    position: { lat: 13.41, lng: 103.86 },
    title: 'Angkor Wat',
    category: 'temple',
    entryFeeUsd: 37,
    ...over,
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('saveOfflineMapMarkers / loadOfflineMapMarkers round-trip', () => {
  it('persists markers and restores them with the same shape', () => {
    const markers = [
      marker({ id: 'place:a', entityId: 'a' }),
      marker({ id: 'festival:f', entityId: 'f', kind: 'festival', title: 'Water Festival' }),
    ]
    expect(saveOfflineMapMarkers(markers)).toBe(true)

    const restored = loadOfflineMapMarkers()
    expect(restored).toHaveLength(2)
    expect(restored[0]).toMatchObject({ id: 'place:a', entityId: 'a', kind: 'place' })
    expect(restored[1]).toMatchObject({ id: 'festival:f', kind: 'festival' })
    expect(restored[0].position).toEqual({ lat: 13.41, lng: 103.86 })
  })

  it('writes a versioned, timestamped envelope', () => {
    saveOfflineMapMarkers([marker()])
    const raw = JSON.parse(localStorage.getItem(OFFLINE_MAP_CACHE_KEY)!)
    expect(raw.version).toBe(OFFLINE_MAP_CACHE_VERSION)
    expect(typeof raw.updatedAt).toBe('number')
    expect(Array.isArray(raw.markers)).toBe(true)
  })
})

describe('saveOfflineMapMarkers guards', () => {
  it('does not overwrite a good snapshot with an empty list', () => {
    saveOfflineMapMarkers([marker()])
    expect(saveOfflineMapMarkers([])).toBe(false)
    // Previous snapshot is preserved.
    expect(loadOfflineMapMarkers()).toHaveLength(1)
  })

  it('drops invalid markers before persisting', () => {
    const good = marker({ id: 'place:ok', entityId: 'ok' })
    const bad = {
      id: 'x',
      kind: 'place',
      entityId: 'x',
      title: 'no position',
    } as unknown as ExploreMarker
    saveOfflineMapMarkers([good, bad])
    const restored = loadOfflineMapMarkers()
    expect(restored.map((m) => m.entityId)).toEqual(['ok'])
  })

  it('caps the number of persisted markers', () => {
    const many = Array.from({ length: OFFLINE_MAP_MAX_MARKERS + 25 }, (_, i) =>
      marker({ id: `place:${i}`, entityId: String(i) }),
    )
    saveOfflineMapMarkers(many)
    expect(loadOfflineMapMarkers()).toHaveLength(OFFLINE_MAP_MAX_MARKERS)
  })
})

describe('loadOfflineMapMarkers tolerance', () => {
  it('returns [] when nothing is stored', () => {
    expect(loadOfflineMapMarkers()).toEqual([])
  })

  it('returns [] for malformed JSON', () => {
    localStorage.setItem(OFFLINE_MAP_CACHE_KEY, '{not json')
    expect(loadOfflineMapMarkers()).toEqual([])
  })

  it('ignores snapshots with a mismatched version', () => {
    localStorage.setItem(
      OFFLINE_MAP_CACHE_KEY,
      JSON.stringify({ version: 999, updatedAt: Date.now(), markers: [marker()] }),
    )
    expect(loadOfflineMapMarkers()).toEqual([])
  })

  it('filters out individually invalid entries from a stored snapshot', () => {
    localStorage.setItem(
      OFFLINE_MAP_CACHE_KEY,
      JSON.stringify({
        version: OFFLINE_MAP_CACHE_VERSION,
        updatedAt: Date.now(),
        markers: [marker({ entityId: 'ok' }), { id: 'bad' }, null, 42],
      }),
    )
    const restored = loadOfflineMapMarkers()
    expect(restored).toHaveLength(1)
    expect(restored[0].entityId).toBe('ok')
  })
})

describe('clearOfflineMapMarkers', () => {
  it('removes the cached snapshot', () => {
    saveOfflineMapMarkers([marker()])
    clearOfflineMapMarkers()
    expect(localStorage.getItem(OFFLINE_MAP_CACHE_KEY)).toBeNull()
    expect(loadOfflineMapMarkers()).toEqual([])
  })
})
