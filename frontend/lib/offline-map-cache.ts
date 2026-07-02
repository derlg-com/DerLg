/**
 * Offline persistence for Explore map locations (task 9.3, Requirement 11).
 *
 * ## Why this exists (and what it deliberately does NOT do)
 *
 * Requirement 11 was written assuming self-served OpenStreetMap **raster tiles**
 * that a Service Worker can cache for offline use. This app instead renders maps
 * with the Google Maps JS SDK (`@vis.gl/react-google-maps`). With that SDK the
 * tile/imagery requests are issued **internally by Google's script** from
 * Google's own origins, return **opaque cross-origin responses**, use dynamic
 * (session-scoped) URLs, and are subject to Google Maps ToS caching
 * restrictions. A Service Worker therefore cannot reliably or lawfully cache the
 * tiles themselves, so the literal "cache map tiles for offline use" is not
 * achievable on this stack.
 *
 * The **achievable** offline-map experience for a Google Maps app — and the one
 * we implement — is to cache the map *entity data* (the places and festivals
 * with coordinates that we plot). When the user reopens the app offline, the
 * live tiles can't render, but {@link ExploreMapTab}'s existing list fallback
 * can still show the saved locations from this cache, so the data stays
 * discoverable (Requirement 11.8 — "markers for saved places and bookings").
 *
 * This module is intentionally pure/storage-only (no React, no Google Maps) so
 * it is trivially unit-testable. It stores a small, versioned, size-bounded
 * snapshot of the normalized {@link ExploreMarker} list in `localStorage`,
 * mirroring the chat-history persistence pattern used elsewhere in the app.
 */

import type { ExploreMarker } from '@/lib/explore-map'

/** `localStorage` key for the cached Explore map locations. */
export const OFFLINE_MAP_CACHE_KEY = 'derlg:offline-map:v1'

/** Schema version, bumped if the persisted shape changes (old data is dropped). */
export const OFFLINE_MAP_CACHE_VERSION = 1

/**
 * Upper bound on how many markers we persist. The Explore tab loads ~50 places
 * + ~50 festivals, so 200 leaves comfortable headroom while keeping the
 * serialized payload tiny (well under typical localStorage quotas).
 */
export const OFFLINE_MAP_MAX_MARKERS = 200

/** Persisted envelope written to `localStorage`. */
export interface OfflineMapSnapshot {
  version: number
  /** Epoch ms when the snapshot was written (for future staleness display). */
  updatedAt: number
  markers: ExploreMarker[]
}

/** Safe handle to `localStorage`, or `null` when unavailable (SSR / blocked). */
function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage
  } catch {
    // Accessing localStorage can throw (e.g. disabled cookies / privacy mode).
    return null
  }
}

/** Whether a value looks like a usable, finite coordinate pair on a marker. */
function hasFinitePosition(m: ExploreMarker): boolean {
  return (
    !!m.position &&
    typeof m.position.lat === 'number' &&
    typeof m.position.lng === 'number' &&
    Number.isFinite(m.position.lat) &&
    Number.isFinite(m.position.lng)
  )
}

/** Narrow an unknown value to a single valid {@link ExploreMarker}. */
function isValidMarker(value: unknown): value is ExploreMarker {
  if (value === null || typeof value !== 'object') return false
  const m = value as Partial<ExploreMarker>
  if (typeof m.id !== 'string' || typeof m.entityId !== 'string') return false
  if (m.kind !== 'place' && m.kind !== 'festival') return false
  if (typeof m.title !== 'string') return false
  return hasFinitePosition(m as ExploreMarker)
}

/**
 * Persist the given Explore markers for offline use.
 *
 * No-ops when storage is unavailable or when `markers` is empty (we never
 * overwrite a good snapshot with an empty one — an empty live result while
 * offline should keep the previously cached locations). Returns `true` when a
 * snapshot was written.
 */
export function saveOfflineMapMarkers(markers: ExploreMarker[]): boolean {
  const storage = getStorage()
  if (!storage) return false
  if (!Array.isArray(markers) || markers.length === 0) return false

  const snapshot: OfflineMapSnapshot = {
    version: OFFLINE_MAP_CACHE_VERSION,
    updatedAt: Date.now(),
    markers: markers.filter(isValidMarker).slice(0, OFFLINE_MAP_MAX_MARKERS),
  }
  if (snapshot.markers.length === 0) return false

  try {
    storage.setItem(OFFLINE_MAP_CACHE_KEY, JSON.stringify(snapshot))
    return true
  } catch {
    // Quota exceeded or serialization failure — non-fatal for offline support.
    return false
  }
}

/**
 * Load the cached Explore markers, or `[]` when nothing valid is stored.
 *
 * Tolerant of malformed/legacy payloads: a wrong version, bad JSON, or invalid
 * entries are ignored (invalid markers are filtered out individually) so a
 * corrupt cache can never crash the map surface.
 */
export function loadOfflineMapMarkers(): ExploreMarker[] {
  const storage = getStorage()
  if (!storage) return []

  const raw = storage.getItem(OFFLINE_MAP_CACHE_KEY)
  if (!raw) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }

  if (parsed === null || typeof parsed !== 'object') return []
  const snap = parsed as Partial<OfflineMapSnapshot>
  if (snap.version !== OFFLINE_MAP_CACHE_VERSION) return []
  if (!Array.isArray(snap.markers)) return []

  return snap.markers.filter(isValidMarker).slice(0, OFFLINE_MAP_MAX_MARKERS)
}

/** Remove any cached offline map data (used by "clear cached map data"). */
export function clearOfflineMapMarkers(): void {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.removeItem(OFFLINE_MAP_CACHE_KEY)
  } catch {
    // Ignore — clearing is best-effort.
  }
}
