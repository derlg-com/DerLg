/**
 * Google Maps handoff links.
 *
 * The embedded map stays Leaflet/OpenStreetMap (no API key, no billing, works
 * offline-ish with cached tiles). What travellers actually need Google Maps for is
 * the things a static embed cannot do — turn-by-turn directions, live traffic,
 * street view, saving a pin, opening the native app — so those are handed off via
 * the Google Maps URL API instead.
 *
 * The URL API is deliberately keyless and stable:
 * https://developers.google.com/maps/documentation/urls/get-started
 * That matters here: no key means nothing to leak from the client and no quota to
 * exhaust, and the link degrades to the Google Maps website when the app is absent.
 */

export interface GeoPoint {
  lat: number
  lng: number
}

/** True when a coordinate pair is usable — (0,0) is in the Atlantic, not Cambodia. */
export function hasCoordinates(
  point: Partial<GeoPoint> | null | undefined,
): point is GeoPoint {
  if (!point) return false
  const { lat, lng } = point
  if (typeof lat !== 'number' || typeof lng !== 'number') return false
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  if (lat === 0 && lng === 0) return false
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180
}

/** Trims to 6dp (~11cm) — more digits are noise and make the URL harder to read. */
function coord(point: GeoPoint): string {
  return `${round(point.lat)},${round(point.lng)}`
}

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6
}

/**
 * Opens the location in Google Maps.
 *
 * The coordinate is the `query`, with the name passed as `query_place_id`'s
 * human-readable companion only when there is no coordinate — searching by name
 * alone can land on a same-named place in another country, whereas a coordinate
 * is unambiguous.
 */
export function googleMapsPlaceUrl(
  point: Partial<GeoPoint> | null | undefined,
  name?: string,
): string | null {
  if (hasCoordinates(point)) {
    const url = new URL('https://www.google.com/maps/search/')
    url.searchParams.set('api', '1')
    url.searchParams.set('query', coord(point))
    return url.toString()
  }

  const label = name?.trim()
  if (!label) return null

  const url = new URL('https://www.google.com/maps/search/')
  url.searchParams.set('api', '1')
  // Scoped to Cambodia so a generic name cannot resolve to another country.
  url.searchParams.set('query', `${label}, Cambodia`)
  return url.toString()
}

export type TravelMode = 'driving' | 'walking' | 'transit' | 'bicycling'

/**
 * Directions to a destination.
 *
 * `origin` is left unset when unknown so Google uses the device's own location,
 * which is what a traveller standing in Phnom Penh actually wants.
 */
export function googleMapsDirectionsUrl(
  destination: Partial<GeoPoint> | null | undefined,
  options: { origin?: Partial<GeoPoint> | string; mode?: TravelMode; destinationName?: string } = {},
): string | null {
  const target = hasCoordinates(destination)
    ? coord(destination)
    : options.destinationName?.trim()
      ? `${options.destinationName.trim()}, Cambodia`
      : null

  if (!target) return null

  const url = new URL('https://www.google.com/maps/dir/')
  url.searchParams.set('api', '1')
  url.searchParams.set('destination', target)
  url.searchParams.set('travelmode', options.mode ?? 'driving')

  const { origin } = options
  if (typeof origin === 'string' && origin.trim()) {
    url.searchParams.set('origin', `${origin.trim()}, Cambodia`)
  } else if (origin && typeof origin !== 'string' && hasCoordinates(origin)) {
    url.searchParams.set('origin', coord(origin))
  }

  return url.toString()
}

/**
 * Multi-stop view for a set of markers.
 *
 * Google's URL API has no "show these N pins" mode, so a route through them is the
 * closest honest equivalent: the first marker becomes the origin, the last the
 * destination, and up to 8 in between become waypoints (the API's documented cap).
 * With fewer than two points there is no route, so this falls back to a place link.
 */
export function googleMapsRouteUrl(points: Partial<GeoPoint>[]): string | null {
  const usable = points.filter(hasCoordinates)
  const first = usable[0]
  const last = usable[usable.length - 1]
  if (!first || !last) return null
  if (usable.length === 1) return googleMapsPlaceUrl(first)

  const url = new URL('https://www.google.com/maps/dir/')
  url.searchParams.set('api', '1')
  url.searchParams.set('origin', coord(first))
  url.searchParams.set('destination', coord(last))
  url.searchParams.set('travelmode', 'driving')

  const waypoints = usable.slice(1, -1).slice(0, 8)
  if (waypoints.length > 0) {
    url.searchParams.set('waypoints', waypoints.map(coord).join('|'))
  }

  return url.toString()
}

/** Straight-line distance in km. Not a driving distance — label it as such. */
export function haversineKm(from: GeoPoint, to: GeoPoint): number {
  const R = 6371
  const dLat = toRad(to.lat - from.lat)
  const dLng = toRad(to.lng - from.lng)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/** Phnom Penh — the default departure point for most DerLg itineraries. */
export const PHNOM_PENH: GeoPoint = { lat: 11.5564, lng: 104.9282 }
