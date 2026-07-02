'use client'

import { APIProvider, Map, type MapProps } from '@vis.gl/react-google-maps'
import { MapPin } from 'lucide-react'
import { useTranslations } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

/** Lat/Lng pair used for map centering. */
export interface LatLng {
  lat: number
  lng: number
}

/** Read at render time (not module load) so tests can stub the env var. */
export function getMapsApiKey(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
}

/** True when a Google Maps API key is configured. */
export function hasMapsApiKey(): boolean {
  return getMapsApiKey().length > 0
}

/** Default map center — Cambodia (roughly Phnom Penh) since this is a Cambodia-only product. */
export const DEFAULT_MAP_CENTER: LatLng = { lat: 11.5564, lng: 104.9282 }
export const DEFAULT_MAP_ZOOM = 7

export interface BaseMapProps {
  /** Initial center of the map. Defaults to Cambodia. */
  center?: LatLng
  /** Initial zoom level. Defaults to a country-level view. */
  zoom?: number
  /**
   * Markers/overlays to render inside the map. Marker components from task 9.2
   * are passed as children so this stays a generic, reusable foundation.
   */
  children?: ReactNode
  /** Optional stable Map ID, required by Google for AdvancedMarker styling. */
  mapId?: string
  /** Extra classes for the map container. Height should be provided by the caller. */
  className?: string
  /** Accessible label for the fallback region when no API key is configured. */
  fallbackLabel?: string
  /** Additional Google Map options forwarded to the underlying <Map />. */
  mapOptions?: Omit<MapProps, 'defaultCenter' | 'defaultZoom' | 'mapId' | 'style'>
}

/**
 * Reusable, SSR-safe Google Maps foundation for the app.
 *
 * This is the generic base used across map surfaces (Explore map, future place
 * and booking maps). It renders a Google Map when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
 * is configured and a graceful fallback panel otherwise, so pages relying on a
 * map never break when the key is absent (e.g. local dev, CI, offline builds).
 *
 * Markers and interactions are intentionally NOT built in here — callers pass
 * marker children (task 9.2). Offline tile caching and offline mode are handled
 * separately (tasks 9.3 / 9.4).
 */
export function BaseMap({
  center = DEFAULT_MAP_CENTER,
  zoom = DEFAULT_MAP_ZOOM,
  children,
  mapId = 'derlg-base-map',
  className,
  fallbackLabel,
  mapOptions,
}: BaseMapProps) {
  const t = useTranslations('explore.map')
  const apiKey = getMapsApiKey()

  if (!apiKey) {
    return (
      <div
        role="status"
        aria-label={fallbackLabel ?? t('unavailable')}
        data-testid="base-map-fallback"
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground',
          className,
        )}
      >
        <MapPin className="h-6 w-6" aria-hidden />
        <span>{fallbackLabel ?? t('unavailable')}</span>
      </div>
    )
  }

  return (
    <div
      data-testid="base-map"
      className={cn('overflow-hidden rounded-lg border border-border', className)}
    >
      <APIProvider apiKey={apiKey}>
        <Map
          style={{ width: '100%', height: '100%' }}
          defaultCenter={center}
          defaultZoom={zoom}
          mapId={mapId}
          gestureHandling="cooperative"
          disableDefaultUI
          {...mapOptions}
        >
          {children}
        </Map>
      </APIProvider>
    </div>
  )
}
