'use client'

import { useState } from 'react'
import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps'
import type { ContentItem } from '@/stores/vibe-booking.store'
import { haversineKm, PHNOM_PENH, type LatLng } from '@/lib/geo'

interface MapMarker {
  id: string
  lat: number
  lng: number
  label?: string
}
interface Props {
  item: ContentItem
  onAction: (t: string, id?: string, p?: Record<string, unknown>) => void
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

export default function MapViewRenderer({ item }: Props) {
  const { center, markers = [] } = item.data as {
    center: LatLng
    markers?: MapMarker[]
  }
  const [userLoc, setUserLoc] = useState<LatLng | null>(null)
  const target = markers[0] ?? center

  const requestLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setUserLoc(null),
    )
  }

  if (!API_KEY) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Map unavailable — set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
      </div>
    )
  }

  return (
    <div className="p-4 space-y-2">
      <div className="h-56 w-full overflow-hidden rounded-lg">
        <APIProvider apiKey={API_KEY}>
          <Map
            defaultCenter={center}
            defaultZoom={9}
            gestureHandling="greedy"
            disableDefaultUI
          >
            {markers.map((m) => (
              <Marker key={m.id} position={{ lat: m.lat, lng: m.lng }} title={m.label} />
            ))}
          </Map>
        </APIProvider>
      </div>
      <p className="text-xs text-muted-foreground">
        ≈ {haversineKm(PHNOM_PENH, target).toFixed(0)} km from Phnom Penh
      </p>
      {userLoc ? (
        <p className="text-xs text-muted-foreground">
          ≈ {haversineKm(userLoc, target).toFixed(0)} km from you
        </p>
      ) : (
        <button
          type="button"
          onClick={requestLocation}
          className="text-xs text-primary hover:underline"
        >
          📍 Show distance from my location
        </button>
      )}
    </div>
  )
}
