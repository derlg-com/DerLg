import type { Locale } from '@/lib/i18n/config'

/**
 * Centralised React Query keys.
 *
 * Every key starts with the locale because the backend returns localised content
 * for the same resource id. Without it, switching language would serve Khmer
 * copy from an English cache entry.
 */
export const queryKeys = {
  trips: {
    all: (locale: Locale) => ['trips', locale] as const,
    list: (locale: Locale, filters: object) =>
      ['trips', locale, 'list', filters] as const,
    detail: (locale: Locale, id: string) => ['trips', locale, 'detail', id] as const,
    related: (locale: Locale, id: string) => ['trips', locale, 'related', id] as const,
  },
  hotels: {
    all: (locale: Locale) => ['hotels', locale] as const,
    list: (locale: Locale, filters: object) =>
      ['hotels', locale, 'list', filters] as const,
    detail: (locale: Locale, id: string) => ['hotels', locale, 'detail', id] as const,
    rooms: (locale: Locale, id: string, range?: { checkIn?: string; checkOut?: string }) =>
      ['hotels', locale, 'rooms', id, range ?? {}] as const,
  },
  guides: {
    all: (locale: Locale) => ['guides', locale] as const,
    list: (locale: Locale, filters: object) =>
      ['guides', locale, 'list', filters] as const,
    detail: (locale: Locale, id: string) => ['guides', locale, 'detail', id] as const,
    availability: (locale: Locale, id: string, range: { from: string; to: string }) =>
      ['guides', locale, 'availability', id, range] as const,
  },
  transport: {
    all: (locale: Locale) => ['transport', locale] as const,
    list: (locale: Locale, filters: object) =>
      ['transport', locale, 'list', filters] as const,
    detail: (locale: Locale, id: string) => ['transport', locale, 'detail', id] as const,
    availability: (locale: Locale, id: string, range: { from: string; to: string }) =>
      ['transport', locale, 'availability', id, range] as const,
  },
  places: {
    all: (locale: Locale) => ['places', locale] as const,
    list: (locale: Locale, filters: object) =>
      ['places', locale, 'list', filters] as const,
    detail: (locale: Locale, id: string) => ['places', locale, 'detail', id] as const,
    related: (locale: Locale, id: string) => ['places', locale, 'related', id] as const,
    nearbyTrips: (locale: Locale, id: string) => ['places', locale, 'nearby-trips', id] as const,
  },
  search: {
    query: (locale: Locale, term: string, filters: object = {}) =>
      ['search', locale, term, filters] as const,
  },
  bookings: {
    all: () => ['bookings'] as const,
    list: (filters: object) => ['bookings', 'list', filters] as const,
    detail: (id: string) => ['bookings', 'detail', id] as const,
  },
  me: () => ['me'] as const,
  /** BFF-backed resources; these never hit /v1 directly from the browser. */
  bff: {
    festivals: (locale: Locale, filters: object = {}) =>
      ['bff', 'festivals', locale, filters] as const,
    weather: (locale: Locale, location: string, date: string) =>
      ['bff', 'weather', locale, location, date] as const,
    emergencyContacts: (locale: Locale, location: string) =>
      ['bff', 'emergency-contacts', locale, location] as const,
    loyalty: () => ['bff', 'loyalty'] as const,
    paymentStatus: (bookingId: string) => ['bff', 'payment-status', bookingId] as const,
  },
} as const
