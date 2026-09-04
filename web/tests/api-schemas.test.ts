import { describe, expect, it } from 'vitest'

import {
  GuideDetailSchema,
  GuideSummarySchema,
  HotelDetailSchema,
  HotelSummarySchema,
  PaginatedSchema,
  PlaceDetailSchema,
  PlaceSummarySchema,
  SearchResultSchema,
  TripDetailSchema,
  TripSummarySchema,
  VehicleDetailSchema,
  VehicleSummarySchema,
} from '@/schemas/domain'

import fixtures from './fixtures/api-responses.json'

/**
 * Contract tests against responses captured from the live backend on
 * http://localhost:3003. Regenerate the fixture when the API changes; a failure
 * here means the backend and these schemas have genuinely diverged, which is
 * exactly the signal we want before a page breaks at runtime.
 */

type Fixture = { status: number; json: { success: boolean; data?: unknown; error?: unknown } }
const f = fixtures as unknown as Record<string, Fixture>

function dataOf(name: string): unknown {
  const fixture = f[name]
  expect(fixture, `fixture "${name}" is missing`).toBeDefined()
  return fixture!.json.data
}

describe('envelope shape', () => {
  it('wraps successful responses in { success: true, data }', () => {
    const fixture = f['trips-list']!
    expect(fixture.status).toBe(200)
    expect(fixture.json.success).toBe(true)
    expect(fixture.json.data).toBeDefined()
  })

  it('puts pagination inside data, not in a sibling meta object', () => {
    const data = dataOf('trips-list') as Record<string, unknown>
    expect(Object.keys(data).sort()).toEqual(['items', 'limit', 'page', 'total', 'totalPages'])
    expect(f['trips-list']!.json).not.toHaveProperty('meta')
  })

  it('returns { success: false, error: { code, message } } on failure', () => {
    const notFound = f['error-not-found']!
    expect(notFound.status).toBe(404)
    expect(notFound.json.success).toBe(false)
    expect(notFound.json.error).toMatchObject({ code: 'TRP_NOT_FOUND' })
  })

  it('returns an array of messages for validation failures', () => {
    const invalid = f['error-validation']!
    expect(invalid.status).toBe(400)
    const error = invalid.json.error as { code: string; message: string[] }
    expect(Array.isArray(error.message)).toBe(true)
    expect(error.message[0]).toContain('should not exist')
  })
})

describe('trip schemas', () => {
  it('parses the trip list', () => {
    const parsed = PaginatedSchema(TripSummarySchema).parse(dataOf('trips-list'))
    expect(parsed.items.length).toBeGreaterThan(0)
    expect(parsed.total).toBeGreaterThan(0)
  })

  it('parses trip detail including itinerary days', () => {
    const parsed = TripDetailSchema.parse(dataOf('trip-detail'))
    expect(parsed.id).toBeTruthy()
    expect(parsed.durationDays).toBeGreaterThan(0)
    expect(parsed.itineraryDays?.length ?? 0).toBeGreaterThan(0)
    expect(parsed.itineraryDays?.[0]).toHaveProperty('dayNumber')
  })

  it('accepts null for ratingAverage and location, which the API returns explicitly', () => {
    const raw = dataOf('trips-list') as { items: Record<string, unknown>[] }
    const hasNulls = raw.items.some(
      (item) => item.ratingAverage === null || item.location === null,
    )
    expect(hasNulls, 'fixture should exercise the nullable fields').toBe(true)
    expect(() => PaginatedSchema(TripSummarySchema).parse(raw)).not.toThrow()
  })

  it('parses related trips, which come back as a bare array', () => {
    const related = dataOf('trip-related')
    expect(Array.isArray(related)).toBe(true)
    for (const item of related as unknown[]) {
      expect(() => TripSummarySchema.parse(item)).not.toThrow()
    }
  })
})

describe('hotel schemas', () => {
  it('parses the hotel list, which uses coverImage rather than coverImageUrl', () => {
    const raw = dataOf('hotels-list') as { items: Record<string, unknown>[] }
    expect(raw.items[0]).toHaveProperty('coverImage')
    expect(raw.items[0]).not.toHaveProperty('coverImageUrl')

    const parsed = PaginatedSchema(HotelSummarySchema).parse(raw)
    expect(parsed.items[0]?.name).toBeTruthy()
  })

  it('parses hotel detail with coordinates', () => {
    const parsed = HotelDetailSchema.parse(dataOf('hotel-detail'))
    expect(parsed.id).toBeTruthy()
    expect(typeof parsed.latitude === 'number' || parsed.latitude == null).toBe(true)
  })
})

describe('guide schemas', () => {
  it('parses the guide list even though it carries no name field', () => {
    const raw = dataOf('guides-list') as { items: Record<string, unknown>[] }
    // Documented quirk: the list projection omits the display name entirely.
    expect(raw.items[0]).not.toHaveProperty('name')

    const parsed = PaginatedSchema(GuideSummarySchema).parse(raw)
    expect(parsed.items[0]?.pricePerDayUsd).toBeGreaterThan(0)
    expect(parsed.items[0]?.name ?? null).toBeNull()
  })

  it('parses guide detail', () => {
    const parsed = GuideDetailSchema.parse(dataOf('guide-detail'))
    expect(parsed.id).toBeTruthy()
  })
})

describe('transport schemas', () => {
  it('parses the vehicle list', () => {
    const parsed = PaginatedSchema(VehicleSummarySchema).parse(dataOf('vehicles-list'))
    expect(parsed.items[0]?.capacity).toBeGreaterThan(0)
    expect(parsed.items[0]?.vehicleType).toBeTruthy()
  })

  it('parses vehicle detail', () => {
    const parsed = VehicleDetailSchema.parse(dataOf('vehicle-detail'))
    expect(parsed.id).toBeTruthy()
  })
})

describe('place schemas', () => {
  it('parses the place list with coordinates and entry fee', () => {
    const parsed = PaginatedSchema(PlaceSummarySchema).parse(dataOf('places-list'))
    const first = parsed.items[0]!
    expect(typeof first.latitude).toBe('number')
    expect(typeof first.longitude).toBe('number')
  })

  it('parses place detail', () => {
    const parsed = PlaceDetailSchema.parse(dataOf('place-detail'))
    expect(parsed.id).toBeTruthy()
  })
})

describe('search schema', () => {
  it('parses mixed-kind search results', () => {
    const parsed = PaginatedSchema(SearchResultSchema).parse(dataOf('search'))
    expect(parsed.items.length).toBeGreaterThan(0)
    const first = parsed.items[0]!
    expect(first.kind).toBeTruthy()
    expect(first.title).toBeTruthy()
  })
})
