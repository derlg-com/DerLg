'use client'

import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps'
import type { LatLng } from '@/lib/geo'

export interface MapMarker {
  id: string
  lat: number
  lng: number
  label?: string
}

interface Props {
  apiKey: string
  center: LatLng
  markers: MapMarker[]
}

/**
 * Heavy Google Maps tile layer, isolated in its own module so the
 * `@vis.gl/react-google-maps` bundle (and the Google Maps JS API it loads at
 * runtime) is code-split and only fetched once the map is actually rendered
 * (task 17.3 — lazy-load map tiles). The parent {@link MapViewRenderer} guards
 * mounting this behind an in-viewport + online check and a `React.lazy`
 * boundary; rendering this component is what triggers the tile/library load.
 */
export default function MapViewTiles({ apiKey, center, markers }: Props) {
  return (
    <APIProvider apiKey={apiKey}>
      <Map
        defaultCenter={center}
        defaultZoom={9}
        mapId="derlg-vibe-booking"
        gestureHandling="greedy"
        disableDefaultUI
      >
        {markers.map((m) => (
          <AdvancedMarker key={m.id} position={{ lat: m.lat, lng: m.lng }} title={m.label}>
            <Pin />
          </AdvancedMarker>
        ))}
      </Map>
    </APIProvider>
  )
}
