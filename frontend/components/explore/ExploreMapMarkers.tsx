'use client'

import { AdvancedMarker, InfoWindow, Pin, useMap } from '@vis.gl/react-google-maps'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Navigation } from 'lucide-react'
import { useTranslations, useLanguageStore } from '@/lib/i18n'
import { useCurrency } from '@/hooks/use-currency'
import { formatCurrency } from '@/lib/format'
import type { LatLng } from '@/lib/geo'
import { computeBounds, pinStyleFor, type ExploreMarker } from '@/lib/explore-map'

interface ExploreMapMarkersProps {
  markers: ExploreMarker[]
  /**
   * Build the deep link a marker's CTA navigates to. For places this opens the
   * detail modal via `?place=<id>` (task 8.5); for festivals it links to the
   * standalone festival page. Returning `null` hides the CTA.
   */
  hrefFor: (marker: ExploreMarker) => string | null
  /** Optional user location to render as a distinct "you are here" marker. */
  userLocation?: LatLng | null
}

/**
 * Renders the Explore map's markers and their interactions inside {@link BaseMap}
 * (task 9.2, Requirements 4.4, 11.8).
 *
 * - One `AdvancedMarker` per place/festival, styled by category/kind.
 * - Clicking a marker selects it and opens an `InfoWindow` showing the entity
 *   name, a category/kind label, the entry fee (places), and a CTA that
 *   deep-links to the detail surface (`?place=<id>` modal for places, the
 *   festival page for festivals) — consistent with task 8.5.
 * - On mount and whenever the marker set changes, the viewport is fit to the
 *   markers' bounds so every result is visible and the map centers sensibly.
 * - An optional user-location marker is rendered when geolocation is available.
 *
 * This component must be rendered as a child of `<BaseMap>` (i.e. inside the
 * Google `<Map>`/`APIProvider`), so `useMap()` resolves the map instance.
 */
export function ExploreMapMarkers({ markers, hrefFor, userLocation }: ExploreMapMarkersProps) {
  const t = useTranslations('explore.map')
  const map = useMap()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Fit the viewport to all markers whenever they change so the full result set
  // is visible. A single marker keeps a comfortable city-level zoom rather than
  // zooming all the way in.
  useEffect(() => {
    if (!map || markers.length === 0) return
    const bounds = computeBounds(markers)
    if (!bounds) return
    if (markers.length === 1) {
      map.setCenter(markers[0].position)
      map.setZoom(12)
      return
    }
    map.fitBounds(
      {
        south: bounds.south,
        west: bounds.west,
        north: bounds.north,
        east: bounds.east,
      },
      48,
    )
  }, [map, markers])

  // Derive the selected marker from the current set: if the selected id is no
  // longer present (e.g. the result set changed), the InfoWindow simply closes
  // without needing a state-syncing effect.
  const selected = markers.find((m) => m.id === selectedId) ?? null

  return (
    <>
      {markers.map((marker) => {
        const isSelected = marker.id === selectedId
        const style = pinStyleFor(marker, isSelected)
        return (
          <AdvancedMarker
            key={marker.id}
            position={marker.position}
            title={marker.title}
            zIndex={isSelected ? 10 : 1}
            onClick={() => setSelectedId(marker.id)}
          >
            <Pin
              scale={isSelected ? 1.3 : 1}
              background={style.background}
              borderColor={style.borderColor}
              glyphColor={style.glyphColor}
            />
          </AdvancedMarker>
        )
      })}

      {selected ? (
        <InfoWindow
          position={selected.position}
          onCloseClick={() => setSelectedId(null)}
          pixelOffset={[0, -36]}
        >
          <MarkerInfo marker={selected} href={hrefFor(selected)} t={t} />
        </InfoWindow>
      ) : null}

      {userLocation ? (
        <AdvancedMarker
          position={userLocation}
          title={t('youAreHere')}
          zIndex={20}
          data-testid="explore-user-marker"
        >
          <Pin background="#0ea5e9" borderColor="#0369a1" glyphColor="#ffffff" />
        </AdvancedMarker>
      ) : null}
    </>
  )
}

interface MarkerInfoProps {
  marker: ExploreMarker
  href: string | null
  t: ReturnType<typeof useTranslations>
}

/** InfoWindow body: entity name, kind/category, fee (places), and a CTA. */
function MarkerInfo({ marker, href, t }: MarkerInfoProps) {
  const locale = useLanguageStore((s) => s.locale)
  const currency = useCurrency()

  const kindLabel =
    marker.kind === 'festival'
      ? t('kind.festival')
      : t(`category.${marker.category}`, undefined, 'kind.place')

  const free = marker.entryFeeUsd == null || marker.entryFeeUsd <= 0
  const feeLabel =
    marker.kind === 'place'
      ? free
        ? t('free')
        : formatCurrency(marker.entryFeeUsd as number, locale, currency)
      : null

  return (
    <div className="min-w-44 max-w-56 space-y-1.5 p-1" data-testid="explore-info-window">
      <p className="font-display text-sm font-semibold leading-snug text-foreground">
        {marker.title}
      </p>
      <p className="text-xs text-muted-foreground">
        {kindLabel}
        {feeLabel ? <span className="font-medium text-foreground"> · {feeLabel}</span> : null}
      </p>
      {href ? (
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <Navigation className="h-3.5 w-3.5" aria-hidden />
          {t('viewDetails')}
        </Link>
      ) : null}
    </div>
  )
}
