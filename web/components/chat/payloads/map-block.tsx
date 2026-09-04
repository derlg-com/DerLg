'use client'

import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import * as React from 'react'

import { DirectionsLink, GoogleMapsLink } from '@/components/chat/maps-links'
import { Button, Skeleton } from '@/components/ui'
import type { MapMarker } from '@/components/map/leaflet-map'
import { googleMapsDirectionsUrl, googleMapsRouteUrl } from '@/lib/maps/google'
import type { ContentPayload } from '@/schemas/vibe-payloads'

/**
 * Map block for chat replies.
 *
 * The agent AUTO-DERIVES a map_view (agent/core.py _derive_map_view) whenever any
 * card or detail in the turn carries coordinates, so this block appears often and
 * has to be cheap.
 *
 * Loaded with ssr:false because Leaflet reads `window` at import time, and it
 * reuses the same imperative map component as the explore page rather than a second
 * implementation.
 */
const LeafletMap = dynamic(
  () => import('@/components/map/leaflet-map').then((mod) => mod.LeafletMap),
  {
    ssr: false,
    loading: () => <Skeleton className="h-56 w-full rounded-[var(--radius-md)]" />,
  },
)

type MapViewData = Extract<ContentPayload, { type: 'map_view' }>['data']

/** The agent's marker `type` maps onto the pin kinds the map understands. */
function toKind(type: string | undefined): MapMarker['kind'] {
  if (type === 'trip' || type === 'hotel') return type
  return 'place'
}

export function MapViewBlock({
  data,
  selectedId,
  onSelect,
  onAsk,
}: {
  data: MapViewData
  selectedId?: string | null
  onSelect?: (id: string | null) => void
  onAsk?: (text: string) => void
}) {
  const t = useTranslations('explore')
  const tContent = useTranslations('content')

  const markers = React.useMemo<MapMarker[]>(
    () =>
      data.markers.map((marker, index) => ({
        id: marker.id || `marker-${index}`,
        latitude: marker.lat,
        longitude: marker.lng,
        // A pin with no label is unusable for keyboard and screen-reader users.
        label: marker.label ?? `${index + 1}`,
        kind: toKind(marker.type),
      })),
    [data.markers],
  )

  // Nothing mappable means nothing to show; the cards already carry the detail.
  if (markers.length === 0) return null

  const selectedMarker = selectedId ? data.markers.find((m) => m.id === selectedId) : null
  const points = data.markers.map((marker) => ({ lat: marker.lat, lng: marker.lng }))
  /*
   * Spec §7 asks for Google Maps. The EMBED stays Leaflet — it needs no API key,
   * no billing account, and renders identically for a signed-out guest — while the
   * things only Google can do (live directions, traffic, street view, the native
   * app) are handed off by link. That keeps the map free and still answers "how far
   * is it from Phnom Penh?" and "show me the route".
   */
  const routeUrl = googleMapsRouteUrl(points)
  const directionsUrl = selectedMarker
    ? googleMapsDirectionsUrl({ lat: selectedMarker.lat, lng: selectedMarker.lng })
    : googleMapsDirectionsUrl(points[0] ?? null)

  return (
    <div className="flex flex-col gap-2" data-testid="map-view-block">
      <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)]">
        <LeafletMap
          markers={markers}
          selectedId={selectedId}
          onSelect={(id) => onSelect?.(id)}
          className="h-56 w-full"
          ariaLabel={t('map.mapLabel')}
        />

        {/* Interactive Floating Product Card when a pin is selected */}
        {selectedMarker ? (
          <div className="absolute top-2.5 left-2.5 right-2.5 z-1000 flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface)]/95 p-2.5 shadow-md backdrop-blur-xs">
            <div className="min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)]">
                {selectedMarker.type ?? 'Place'}
              </span>
              <p className="truncate text-xs font-semibold text-[var(--text-primary)]">
                {selectedMarker.label}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {onAsk ? (
                <Button
                  size="sm"
                  variant="primary"
                  className="h-7 px-2.5 text-xs font-medium"
                  onClick={() => onAsk(`Book ${selectedMarker.label}`)}
                >
                  {tContent('bookNow')}
                </Button>
              ) : null}
              {onAsk ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 px-2 text-xs"
                  onClick={() => onAsk(`Tell me more about ${selectedMarker.label}`)}
                >
                  {tContent('viewDetails')}
                </Button>
              ) : null}
              <button
                type="button"
                onClick={() => onSelect?.(null)}
                className="flex size-7 items-center justify-center rounded-md text-xs text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {routeUrl || directionsUrl ? (
        <div className="flex flex-wrap gap-1.5">
          {routeUrl ? <GoogleMapsLink href={routeUrl} /> : null}
          {directionsUrl ? <DirectionsLink href={directionsUrl} /> : null}
        </div>
      ) : null}
    </div>
  )
}
