'use client'

import { lazy, Suspense, useState } from 'react'
import { MapPin, WifiOff } from 'lucide-react'
import type { ContentItem } from '@/stores/vibe-booking.store'
import { haversineKm, PHNOM_PENH, type LatLng } from '@/lib/geo'
import { useTranslations } from '@/lib/i18n'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { useInViewport } from '@/hooks/use-in-viewport'
import ErrorBoundary from '@/components/shared/ErrorBoundary'
import type { MapMarker } from './MapViewTiles'

// Code-split the Google Maps tile layer: the heavy `@vis.gl/react-google-maps`
// bundle is only fetched when this lazy component is actually rendered, which
// the guards below defer until the map is in the viewport and the device is
// online (task 17.3 — lazy-load map tiles with offline fallback).
const MapViewTiles = lazy(() => import('./MapViewTiles'))

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
  const t = useTranslations('map')
  const online = useOnlineStatus()
  const { ref, inView } = useInViewport<HTMLDivElement>({ rootMargin: '200px' })
  const [userLoc, setUserLoc] = useState<LatLng | null>(null)

  const target = markers[0] ?? center
  // Map tiles can only load when we have an API key, the device is online, and
  // the container has scrolled near the viewport. Otherwise we show the
  // offline-friendly fallback below instead of broken tile images.
  const canLoadTiles = Boolean(API_KEY) && online && inView

  const requestLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setUserLoc(null),
    )
  }

  const primaryLabel = markers[0]?.label

  return (
    <div className="p-4 space-y-2">
      <div ref={ref} className="h-56 w-full overflow-hidden rounded-lg border border-border">
        {canLoadTiles ? (
          <ErrorBoundary
            fallback={
              <MapFallback online={online} hasApiKey label={primaryLabel} center={target} />
            }
          >
            <Suspense fallback={<MapTilesLoading label={t('loading')} />}>
              <MapViewTiles apiKey={API_KEY} center={center} markers={markers} />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <MapFallback
            online={online}
            hasApiKey={Boolean(API_KEY)}
            label={primaryLabel}
            center={target}
          />
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {t('distanceFromPhnomPenh', { km: haversineKm(PHNOM_PENH, target).toFixed(0) })}
      </p>
      {userLoc ? (
        <p className="text-xs text-muted-foreground">
          {t('distanceFromYou', { km: haversineKm(userLoc, target).toFixed(0) })}
        </p>
      ) : (
        <button
          type="button"
          onClick={requestLocation}
          className="text-xs text-primary hover:underline"
        >
          {t('showDistanceFromMe')}
        </button>
      )}
    </div>
  )
}

function MapTilesLoading({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted/40 text-sm text-muted-foreground">
      {label}
    </div>
  )
}

interface FallbackProps {
  online: boolean
  hasApiKey: boolean
  label?: string
  center: LatLng
}

/**
 * Graceful, offline-first fallback shown when the interactive map cannot load
 * (device offline, tiles failed to fetch, or no Maps API key configured).
 * Surfaces the location name and coordinates plus a localized explanation so
 * the user still gets useful context instead of broken tile images.
 */
function MapFallback({ online, hasApiKey, label, center }: FallbackProps) {
  const t = useTranslations('map')
  const message = !online
    ? t('unavailableOffline')
    : hasApiKey
      ? t('unavailable')
      : t('unavailableNoKey')
  const coords = `${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`

  return (
    <div
      data-testid="map-fallback"
      role="img"
      aria-label={`${label ?? coords} — ${message}`}
      className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-muted/40 p-4 text-center"
    >
      <span className="text-muted-foreground">
        {online ? <MapPin size={20} aria-hidden /> : <WifiOff size={20} aria-hidden />}
      </span>
      {label && <p className="text-sm font-medium text-foreground">{label}</p>}
      <p className="text-xs text-muted-foreground">{coords}</p>
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  )
}
