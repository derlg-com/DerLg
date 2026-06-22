import { describe, it, expect } from 'vitest'
import { resolveContentPayloads, sanitizeSuggestions } from '@/lib/vibe-content'

describe('resolveContentPayloads', () => {
  it('prefers the content_payloads list', () => {
    const out = resolveContentPayloads({
      content_payloads: [
        { type: 'trip_cards', data: { trips: [] } },
        { type: 'weather', data: { forecast: [] } },
      ],
      content_payload: { type: 'text_summary', data: { text: 'x' } },
    })
    expect(out.map((p) => (p as { type: string }).type)).toEqual(['trip_cards', 'weather'])
  })

  it('falls back to the singular content_payload', () => {
    const out = resolveContentPayloads({ content_payload: { type: 'hotel_cards', data: { hotels: [] } } })
    expect(out).toHaveLength(1)
    expect((out[0] as { type: string }).type).toBe('hotel_cards')
  })

  it('drops a standalone map_view when a card-list block is present', () => {
    const out = resolveContentPayloads({
      content_payloads: [
        { type: 'trip_cards', data: { trips: [] } },
        { type: 'map_view', data: { center: { lat: 13, lng: 103 }, markers: [] } },
      ],
    })
    const types = out.map((p) => (p as { type: string }).type)
    expect(types).toContain('trip_cards')
    expect(types).not.toContain('map_view')
  })

  it('keeps a standalone map_view when there are no cards', () => {
    const out = resolveContentPayloads({
      content_payloads: [{ type: 'map_view', data: { center: { lat: 13, lng: 103 }, markers: [] } }],
    })
    expect(out.map((p) => (p as { type: string }).type)).toEqual(['map_view'])
  })

  it('keeps the map_view for a comparison (it has no inline map)', () => {
    const out = resolveContentPayloads({
      content_payloads: [
        { type: 'comparison', data: { items: [] } },
        { type: 'map_view', data: { center: { lat: 13, lng: 103 }, markers: [] } },
      ],
    })
    const types = out.map((p) => (p as { type: string }).type)
    expect(types).toContain('comparison')
    expect(types).toContain('map_view')
  })

  it('returns an empty list when there is no content', () => {
    expect(resolveContentPayloads({})).toEqual([])
  })
})

describe('sanitizeSuggestions', () => {
  it('keeps non-empty strings, capped at 4', () => {
    expect(sanitizeSuggestions(['a', 'b', '', '  ', 'c', 'd', 'e'])).toEqual(['a', 'b', 'c', 'd'])
  })
  it('returns [] for non-arrays', () => {
    expect(sanitizeSuggestions(undefined)).toEqual([])
    expect(sanitizeSuggestions('nope')).toEqual([])
    expect(sanitizeSuggestions([1, 2, {}])).toEqual([])
  })
})
