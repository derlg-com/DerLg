/**
 * Pure helpers for the Explore → Maps tab markers (task 9.2, Requirements 4.4,
 * 11.8).
 *
 * The interactive map (`@vis.gl/react-google-maps`) renders one marker per
 * place and festival loaded by the Explore tabs. To keep the React layer thin
 * and unit-testable, all of the data shaping — converting the API payloads
 * (`PlaceSummary` / `FestivalSummary`) into a single normalized marker model,
 * filtering out points without usable coordinates, deriving category-based pin
 * styling, and computing a sensible center/bounds so every marker is visible —
 * lives here as pure, total functions with no React or Google Maps dependency.
 */

import type { LatLng } from '@/lib/geo'
import { PHNOM_PENH } from '@/lib/geo'
import type { FestivalSummary, PlaceCategory, PlaceSummary } from '@/types/domain'

/** Which kind of entity a marker represents. */
export type MapMarkerKind = 'place' | 'festival'

/**
 * Normalized marker model rendered on the Explore map. Both places and
 * festivals collapse to this shape so the map renderer stays generic.
 */
export interface ExploreMarker {
  /** Stable, kind-prefixed id (e.g. `place:abc`) so place/festival ids can't collide. */
  id: string
  kind: MapMarkerKind
  /** Underlying entity id (used to build deep links like `?place=<id>`). */
  entityId: string
  position: LatLng
  /** Localized display name. */
  title: string
  /** Place category (places only) — drives pin color/glyph. */
  category?: PlaceCategory
  /** Entry fee in USD (places only); `null`/absent = free. */
  entryFeeUsd?: number | null
}

/**
 * Whether a coordinate pair is usable: finite numbers within valid lat/lng
 * ranges and not the null-island `(0, 0)` placeholder some seed rows carry.
 */
export function hasValidCoords(lat: unknown, lng: unknown): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false
  if (lat === 0 && lng === 0) return false
  return true
}

/** Convert a page of places into markers, dropping any without valid coordinates. */
export function placesToMarkers(places: PlaceSummary[]): ExploreMarker[] {
  const markers: ExploreMarker[] = []
  for (const p of places) {
    if (!hasValidCoords(p.latitude, p.longitude)) continue
    markers.push({
      id: `place:${p.id}`,
      kind: 'place',
      entityId: p.id,
      position: { lat: p.latitude, lng: p.longitude },
      title: p.name,
      category: p.category,
      entryFeeUsd: p.entryFeeUsd,
    })
  }
  return markers
}

/**
 * Festival coordinates are optional on the summary payload (`FestivalSummary`
 * has no lat/lng today), so we read them defensively. Festivals without
 * coordinates are simply omitted from the map (they remain available on the
 * Festivals list/detail surfaces).
 */
export function festivalsToMarkers(festivals: FestivalSummary[]): ExploreMarker[] {
  const markers: ExploreMarker[] = []
  for (const f of festivals) {
    const lat = (f as { latitude?: unknown }).latitude
    const lng = (f as { longitude?: unknown }).longitude
    if (!hasValidCoords(lat, lng)) continue
    markers.push({
      id: `festival:${f.id}`,
      kind: 'festival',
      entityId: f.id,
      position: { lat: lat as number, lng: lng as number },
      title: f.name,
    })
  }
  return markers
}

/** Build the full marker set for the Explore map from both entity lists. */
export function buildExploreMarkers(
  places: PlaceSummary[],
  festivals: FestivalSummary[],
): ExploreMarker[] {
  return [...placesToMarkers(places), ...festivalsToMarkers(festivals)]
}

/** Axis-aligned geographic bounding box. */
export interface LatLngBounds {
  south: number
  west: number
  north: number
  east: number
}

/**
 * Bounding box that contains every marker, or `null` when there are no markers.
 * Used to fit the map viewport so all results are visible (Requirement 4.4 —
 * "an interactive map ... with markers for places and festivals").
 */
export function computeBounds(markers: ExploreMarker[]): LatLngBounds | null {
  if (markers.length === 0) return null
  let south = Infinity
  let north = -Infinity
  let west = Infinity
  let east = -Infinity
  for (const m of markers) {
    south = Math.min(south, m.position.lat)
    north = Math.max(north, m.position.lat)
    west = Math.min(west, m.position.lng)
    east = Math.max(east, m.position.lng)
  }
  return { south, west, north, east }
}

/**
 * A sensible map center: the centroid of all markers, or Phnom Penh when the
 * list is empty (matching the app's default Cambodia view).
 */
export function computeCenter(markers: ExploreMarker[]): LatLng {
  if (markers.length === 0) return { ...PHNOM_PENH }
  const sum = markers.reduce(
    (acc, m) => ({ lat: acc.lat + m.position.lat, lng: acc.lng + m.position.lng }),
    { lat: 0, lng: 0 },
  )
  return { lat: sum.lat / markers.length, lng: sum.lng / markers.length }
}

/** Visual style for a marker pin (consumed by the Google Maps `<Pin />`). */
export interface PinStyle {
  background: string
  borderColor: string
  glyphColor: string
}

/** Festival pins use a single distinct color so they read differently from places. */
export const FESTIVAL_PIN_STYLE: PinStyle = {
  background: '#a855f7',
  borderColor: '#7e22ce',
  glyphColor: '#ffffff',
}

/** Fallback style for places with an unknown/unmapped category. */
export const DEFAULT_PLACE_PIN_STYLE: PinStyle = {
  background: '#2563eb',
  borderColor: '#1d4ed8',
  glyphColor: '#ffffff',
}

/** Highlight style applied to the currently-selected marker. */
export const SELECTED_PIN_STYLE: PinStyle = {
  background: '#ef4444',
  borderColor: '#b91c1c',
  glyphColor: '#ffffff',
}

/** Per-category place pin colors (Requirement 4.4 — custom marker icons by type). */
const PLACE_CATEGORY_PIN_STYLE: Record<string, PinStyle> = {
  temple: { background: '#d97706', borderColor: '#b45309', glyphColor: '#ffffff' },
  museum: { background: '#7c3aed', borderColor: '#6d28d9', glyphColor: '#ffffff' },
  nature: { background: '#16a34a', borderColor: '#15803d', glyphColor: '#ffffff' },
  beach: { background: '#0891b2', borderColor: '#0e7490', glyphColor: '#ffffff' },
  market: { background: '#ea580c', borderColor: '#c2410c', glyphColor: '#ffffff' },
  mountain: { background: '#65a30d', borderColor: '#4d7c0f', glyphColor: '#ffffff' },
  landmark: { background: '#db2777', borderColor: '#be185d', glyphColor: '#ffffff' },
}

/**
 * Resolve the pin style for a marker. Selected markers always use the highlight
 * style; otherwise festivals get the festival color and places get their
 * category color (or the default for unknown categories). Pure and total.
 */
export function pinStyleFor(marker: ExploreMarker, selected: boolean): PinStyle {
  if (selected) return SELECTED_PIN_STYLE
  if (marker.kind === 'festival') return FESTIVAL_PIN_STYLE
  const key = (marker.category ?? '').toLowerCase()
  return PLACE_CATEGORY_PIN_STYLE[key] ?? DEFAULT_PLACE_PIN_STYLE
}
