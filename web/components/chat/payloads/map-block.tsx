'use client'

import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import * as React from 'react'

import { Skeleton } from '@/components/ui'
import type { MapMarker } from '@/components/map/leaflet-map'
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

export function MapViewBlock({ data }: { data: MapViewData }) {
  const t = useTranslations('explore')

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

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)]">
      <LeafletMap markers={markers} className="h-56 w-full" ariaLabel={t('map.mapLabel')} />
    </div>
  )
}
