'use client'

import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps'
import { MapPin, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

export interface GoogleMapViewProps {
  lat: number
  lng: number
  label?: string
  zoom?: number
  className?: string
}

/**
 * Single-marker map. Renders Google Maps when an API key is configured,
 * otherwise a graceful fallback card linking out to Google Maps.
 */
export function GoogleMapView({ lat, lng, label, zoom = 14, className }: GoogleMapViewProps) {
  if (!API_KEY) {
    return (
      <a
        href={`https://www.google.com/maps?q=${lat},${lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-muted text-sm text-muted-foreground transition-colors hover:bg-accent',
          className,
        )}
      >
        <MapPin className="h-6 w-6" aria-hidden />
        <span className="inline-flex items-center gap-1">
          {label ?? 'View location'} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </span>
      </a>
    )
  }

  return (
    <div className={cn('h-48 overflow-hidden rounded-lg border border-border', className)}>
      <APIProvider apiKey={API_KEY}>
        <Map
          style={{ width: '100%', height: '100%' }}
          defaultCenter={{ lat, lng }}
          defaultZoom={zoom}
          gestureHandling="cooperative"
          disableDefaultUI
        >
          <Marker position={{ lat, lng }} title={label} />
        </Map>
      </APIProvider>
    </div>
  )
}
