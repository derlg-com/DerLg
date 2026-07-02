'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { LocateFixed, MapPin, CalendarDays } from 'lucide-react'
import { BaseMap } from '@/components/shared/BaseMap'
import { ExploreMapMarkers } from './ExploreMapMarkers'
import { Button } from '@/components/ui/button'
import { usePlaces } from '@/hooks/use-places'
import { useFestivals } from '@/hooks/use-festivals'
import { useTranslations } from '@/lib/i18n'
import type { LatLng } from '@/lib/geo'
import { buildExploreMarkers, type ExploreMarker } from '@/lib/explore-map'
import { loadOfflineMapMarkers, saveOfflineMapMarkers } from '@/lib/offline-map-cache'

/**
 * Explore "Maps" tab content (task 9.2, Requirements 4.4, 11.8).
 *
 * Loads places (`GET /v1/places`) and festivals (`GET /v1/festivals`) and
 * renders them as interactive markers on the shared {@link BaseMap}. Clicking a
 * marker opens an InfoWindow with the entity's name, category, fee, and a CTA
 * that deep-links to its detail surface — for places the `?place=<id>` modal
 * (task 8.5), for festivals the standalone festival page. A "show my location"
 * control adds a user-location marker via the browser Geolocation API.
 *
 * When no Maps API key is configured, {@link BaseMap} renders its accessible
 * fallback panel; below it we still surface the loaded places/festivals as a
 * simple list so the locations remain discoverable without the Maps JS API
 * (graceful degradation, consistent with the rest of the Explore screen).
 *
 * ## Offline map support (task 9.3, Requirement 11)
 *
 * The Google Maps JS SDK fetches its tiles internally from Google's servers as
 * opaque cross-origin responses, so a Service Worker cannot reliably cache the
 * tiles themselves (see {@link saveOfflineMapMarkers} for the full rationale).
 * Instead we cache the map *entity data*: whenever fresh places/festivals load
 * we persist their normalized markers to `localStorage`. On a later **offline**
 * visit the live queries return nothing, so we fall back to those cached
 * markers — the list fallback below then keeps the saved locations discoverable
 * even though live tiles can't render. This is the achievable "offline maps"
 * experience for a Google Maps app and pairs with the no-key list fallback.
 */
export function ExploreMapTab() {
  const t = useTranslations('explore.map')
  const pathname = usePathname()
  const params = useSearchParams()
  const [userLocation, setUserLocation] = useState<LatLng | null>(null)
  const [geoError, setGeoError] = useState(false)

  // Pull a generous first page of each so the map shows a representative set.
  const placesQuery = usePlaces({ limit: 50 })
  const festivalsQuery = useFestivals({ time: 'all', limit: 50 })

  const places = placesQuery.data?.items
  const festivals = festivalsQuery.data?.items

  const liveMarkers = useMemo(
    () => buildExploreMarkers(places ?? [], festivals ?? []),
    [places, festivals],
  )

  // Persist fresh markers for offline reuse, and seed from the offline cache so
  // saved locations stay visible when the live queries can't reach the API
  // (offline). `liveMarkers` wins whenever it has data.
  // Lazy initializer (not an effect) reads the cache once on mount; it's
  // SSR-safe (loadOfflineMapMarkers returns [] without localStorage).
  const [cachedMarkers] = useState<ExploreMarker[]>(() => loadOfflineMapMarkers())
  useEffect(() => {
    if (liveMarkers.length > 0) saveOfflineMapMarkers(liveMarkers)
  }, [liveMarkers])

  // Show live data when available; otherwise fall back to the cached snapshot
  // so offline visits still render the saved locations.
  const usingOfflineCache = liveMarkers.length === 0 && cachedMarkers.length > 0
  const markers = usingOfflineCache ? cachedMarkers : liveMarkers

  // Build the per-marker CTA target. Places open the `?place=<id>` detail modal
  // owned by task 8.5 (merging the current query so the active tab/filters are
  // preserved); festivals link to their standalone page.
  const hrefFor = (marker: ExploreMarker): string => {
    if (marker.kind === 'festival') return `/festivals/${marker.entityId}`
    const next = new URLSearchParams(params.toString())
    next.set('place', marker.entityId)
    const qs = next.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  const requestLocation = () => {
    setGeoError(false)
    navigator.geolocation?.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        setUserLocation(null)
        setGeoError(true)
      },
    )
  }

  return (
    <section aria-label={t('title')} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t('description')}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={requestLocation}
          aria-pressed={Boolean(userLocation)}
        >
          <LocateFixed className="mr-2 h-4 w-4" aria-hidden />
          {t('showMyLocation')}
        </Button>
      </div>

      {geoError ? (
        <p role="alert" className="text-xs text-destructive">
          {t('locationDenied')}
        </p>
      ) : null}

      <BaseMap className="h-[60vh] min-h-80 w-full" fallbackLabel={t('unavailable')}>
        <ExploreMapMarkers markers={markers} hrefFor={hrefFor} userLocation={userLocation} />
      </BaseMap>

      {/* List fallback: shown when there's no Maps key (the map renders a
          fallback panel) OR when we're serving cached locations offline (live
          tiles can't render), so locations stay discoverable. Hidden once the
          interactive map is showing live data. */}
      <MarkerListFallback markers={markers} hrefFor={hrefFor} offline={usingOfflineCache} />
    </section>
  )
}

interface MarkerListFallbackProps {
  markers: ExploreMarker[]
  hrefFor: (marker: ExploreMarker) => string
  /** True when these markers come from the offline cache (live data was empty). */
  offline?: boolean
}

/**
 * Accessible list of map locations, rendered when the Maps JS API key is absent
 * (live tiles unavailable) or when we're serving cached locations offline. Each
 * item links to the same detail surface as the corresponding marker CTA.
 */
function MarkerListFallback({ markers, hrefFor, offline = false }: MarkerListFallbackProps) {
  const t = useTranslations('explore.map')

  // Render when there's no Maps key (interactive map can't load) or when we're
  // falling back to cached data offline. We gate on the env var (read at
  // render) rather than DOM inspection to keep this deterministic in tests.
  const hasKey = (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '').length > 0
  if ((hasKey && !offline) || markers.length === 0) return null

  return (
    <div className="space-y-1.5">
      {offline ? (
        <p role="status" className="text-xs text-muted-foreground" data-testid="offline-map-note">
          {t('offlineNote')}
        </p>
      ) : null}
      <ul aria-label={t('locationsList')} className="space-y-1.5" data-testid="explore-map-list">
        {markers.map((marker) => {
          const Icon = marker.kind === 'festival' ? CalendarDays : MapPin
          return (
            <li key={marker.id}>
              <Link
                href={hrefFor(marker)}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-muted"
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate text-foreground">{marker.title}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
