import { z } from 'zod'

import {
  AvailabilitySchema,
  GuideDetailSchema,
  GuideSummarySchema,
  HotelDetailSchema,
  HotelRoomSchema,
  HotelSummarySchema,
  PaginatedSchema,
  PlaceDetailSchema,
  PlaceSummarySchema,
  SearchResultSchema,
  TripDetailSchema,
  TripSummarySchema,
  VehicleDetailSchema,
  VehicleSummarySchema,
  type GuideSummary,
  type HotelSummary,
  type PlaceSummary,
  type TripSummary,
  type VehicleSummary,
} from '@/schemas/domain'
import type { Locale } from '@/lib/i18n/config'

import { api, type QueryValue } from './client'
import type { Paginated } from './errors'

/**
 * Resource functions: one per backend endpoint.
 *
 * Each response is parsed with Zod so a backend change surfaces as a clear
 * validation error next to the call rather than as `undefined` deep inside a
 * component. Parsing is lenient about unknown extra fields (Zod strips them) but
 * strict about the fields the UI depends on.
 *
 * Only query parameters the backend DTOs declare may be sent — `ValidationPipe`
 * runs with `forbidNonWhitelisted: true`, so an unexpected field returns 400.
 */

interface Ctx {
  locale: Locale
  token?: string | null
  signal?: AbortSignal
}

/** Params accepted by every list endpoint (ListQueryDto). */
export interface ListParams {
  page?: number
  /** Max 50, enforced by the backend. */
  limit?: number
  /** Free-text term; the backend requires at least 2 characters. */
  q?: string
  sort?: string
}

/**
 * Converts a typed filter object into query params.
 *
 * The filter interfaces deliberately have NO index signature: that keeps
 * TypeScript's excess-property checking active, so a typo'd filter name is a
 * compile error rather than a 400 from the backend's `forbidNonWhitelisted`
 * validation at runtime. The cast is safe because every declared field is a
 * `QueryValue`, and `buildQuery` drops undefined and null entries.
 */
function toQuery<T extends object>(params: T): Record<string, QueryValue> {
  return Object.fromEntries(Object.entries(params)) as Record<string, QueryValue>
}

/** Parses a paginated payload, keeping the pagination metadata intact. */
function parseList<T extends z.ZodTypeAny>(
  schema: T,
  payload: Paginated<unknown>,
): Paginated<z.infer<T>> {
  return PaginatedSchema(schema).parse(payload) as Paginated<z.infer<T>>
}

/* ------------------------------------------------------------------ trips */

export interface TripFilters extends ListParams {
  category?: string
  priceMin?: number
  priceMax?: number
  durationDays?: number
}

export const tripsApi = {
  async list(filters: TripFilters, ctx: Ctx): Promise<Paginated<TripSummary>> {
    const data = await api.list<unknown>('trips', {
      query: toQuery(filters),
      locale: ctx.locale,
      signal: ctx.signal,
    })
    return parseList(TripSummarySchema, data)
  },

  async detail(id: string, ctx: Ctx) {
    const data = await api.get<unknown>(`trips/${id}`, {
      locale: ctx.locale,
      signal: ctx.signal,
    })
    return TripDetailSchema.parse(data)
  },

  async related(id: string, ctx: Ctx): Promise<TripSummary[]> {
    const data = await api.get<unknown>(`trips/${id}/related`, {
      locale: ctx.locale,
      signal: ctx.signal,
    })
    // Related endpoints return a bare array, not a paginated envelope.
    return z.array(TripSummarySchema).parse(data)
  },

  async shareUrl(id: string, ctx: Ctx) {
    const data = await api.get<unknown>(`trips/${id}/share`, {
      locale: ctx.locale,
      signal: ctx.signal,
    })
    return z.object({ url: z.string() }).partial().passthrough().parse(data)
  },
}

/* ----------------------------------------------------------------- hotels */

export interface HotelFilters extends ListParams {
  starRating?: number
}

export const hotelsApi = {
  async list(filters: HotelFilters, ctx: Ctx): Promise<Paginated<HotelSummary>> {
    const data = await api.list<unknown>('hotels', {
      query: toQuery(filters),
      locale: ctx.locale,
      signal: ctx.signal,
    })
    return parseList(HotelSummarySchema, data)
  },

  async detail(id: string, ctx: Ctx) {
    const data = await api.get<unknown>(`hotels/${id}`, {
      locale: ctx.locale,
      signal: ctx.signal,
    })
    return HotelDetailSchema.parse(data)
  },

  async rooms(id: string, range: { checkIn: string; checkOut: string }, ctx: Ctx) {
    const data = await api.get<unknown>(`hotels/${id}/rooms`, {
      query: { checkIn: range.checkIn, checkOut: range.checkOut },
      locale: ctx.locale,
      signal: ctx.signal,
    })
    // Tolerate either a bare array or a paginated payload.
    return Array.isArray(data)
      ? z.array(HotelRoomSchema).parse(data)
      : parseList(HotelRoomSchema, data as Paginated<unknown>).items
  },
}

/* ----------------------------------------------------------------- guides */

export interface GuideFilters extends ListParams {
  /** Backend enum: 'en' | 'zh' | 'km'. */
  language?: string
  speciality?: string
}

export const guidesApi = {
  async list(filters: GuideFilters, ctx: Ctx): Promise<Paginated<GuideSummary>> {
    const data = await api.list<unknown>('guides', {
      query: toQuery(filters),
      locale: ctx.locale,
      signal: ctx.signal,
    })
    return parseList(GuideSummarySchema, data)
  },

  async detail(id: string, ctx: Ctx) {
    const data = await api.get<unknown>(`guides/${id}`, {
      locale: ctx.locale,
      signal: ctx.signal,
    })
    return GuideDetailSchema.parse(data)
  },

  async availability(id: string, range: { from: string; to: string }, ctx: Ctx) {
    const data = await api.get<unknown>(`guides/${id}/availability`, {
      query: { from: range.from, to: range.to },
      locale: ctx.locale,
      signal: ctx.signal,
    })
    return AvailabilitySchema.parse(data)
  },
}

/* --------------------------------------------------------- transportation */

export interface VehicleFilters extends ListParams {
  /**
   * The backend DTO calls this `type`, not `vehicleType`, and there is no
   * province filter — verified against the live API, which rejects both
   * `vehicleType` and `province` with "property should not exist".
   */
  type?: string
}

export const transportApi = {
  async list(filters: VehicleFilters, ctx: Ctx): Promise<Paginated<VehicleSummary>> {
    const data = await api.list<unknown>('transportation/vehicles', {
      query: toQuery(filters),
      locale: ctx.locale,
      signal: ctx.signal,
    })
    return parseList(VehicleSummarySchema, data)
  },

  async detail(id: string, ctx: Ctx) {
    const data = await api.get<unknown>(`transportation/vehicles/${id}`, {
      locale: ctx.locale,
      signal: ctx.signal,
    })
    return VehicleDetailSchema.parse(data)
  },

  async availability(id: string, range: { from: string; to: string }, ctx: Ctx) {
    const data = await api.get<unknown>(`transportation/vehicles/${id}/availability`, {
      query: { from: range.from, to: range.to },
      locale: ctx.locale,
      signal: ctx.signal,
    })
    return AvailabilitySchema.parse(data)
  },
}

/* ----------------------------------------------------------------- places */

export interface PlaceFilters extends ListParams {
  category?: string
}

export const placesApi = {
  async list(filters: PlaceFilters, ctx: Ctx): Promise<Paginated<PlaceSummary>> {
    const data = await api.list<unknown>('places', {
      query: toQuery(filters),
      locale: ctx.locale,
      signal: ctx.signal,
    })
    return parseList(PlaceSummarySchema, data)
  },

  async detail(id: string, ctx: Ctx) {
    const data = await api.get<unknown>(`places/${id}`, {
      locale: ctx.locale,
      signal: ctx.signal,
    })
    return PlaceDetailSchema.parse(data)
  },

  async related(id: string, ctx: Ctx): Promise<PlaceSummary[]> {
    const data = await api.get<unknown>(`places/${id}/related`, {
      locale: ctx.locale,
      signal: ctx.signal,
    })
    return z.array(PlaceSummarySchema).parse(data)
  },

  async nearbyTrips(id: string, ctx: Ctx): Promise<TripSummary[]> {
    const data = await api.get<unknown>(`places/${id}/nearby-trips`, {
      locale: ctx.locale,
      signal: ctx.signal,
    })
    return z.array(TripSummarySchema).parse(data)
  },
}

/* ----------------------------------------------------------------- search */

export const searchApi = {
  async query(term: string, params: ListParams, ctx: Ctx): Promise<Paginated<SearchResult>> {
    const data = await api.list<unknown>('search', {
      query: toQuery({ ...params, q: term }),
      locale: ctx.locale,
      signal: ctx.signal,
    })
    return parseList(SearchResultSchema, data)
  },
}

export type SearchResult = z.infer<typeof SearchResultSchema>
