'use client'

import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'

import L from 'leaflet'
import 'leaflet.markercluster'
import * as React from 'react'

import { cn } from '@/lib/cn'

/** A mappable item. `kind` drives the marker colour and the detail route. */
export interface MapMarker {
  id: string
  latitude: number
  longitude: number
  label: string
  kind: 'place' | 'trip' | 'hotel'
}

/** Cambodia's approximate centre and a zoom that frames the whole country. */
const CAMBODIA_CENTRE: [number, number] = [12.5657, 104.991]
const COUNTRY_ZOOM = 7

const KIND_COLOUR: Record<MapMarker['kind'], string> = {
  place: '#3D9676', // NAVEL jade
  trip: '#1B3232',  // NAVEL forest
  hotel: '#E7B171', // NAVEL gold
}

/**
 * Builds a marker icon from a styled pin matching NAVEL design kit.
 */
function pinIcon(kind: MapMarker['kind'], isSelected?: boolean): L.DivIcon {
  const bg = KIND_COLOUR[kind] || '#3D9676'
  const size = isSelected ? 22 : 16
  const anchor = isSelected ? 11 : 8
  const shadow = isSelected
    ? 'box-shadow: 0 0 0 5px rgba(61, 150, 118, 0.45), 0 3px 10px rgba(0,0,0,0.35);'
    : 'box-shadow: 0 2px 5px rgba(0,0,0,0.25);'

  return L.divIcon({
    className: 'derlg-pin',
    html: `<span style="
      display:block;width:${size}px;height:${size}px;border-radius:9999px;
      background:${bg};
      border:2.5px solid #FFFFFF;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      ${shadow}
    "></span>`,
    iconSize: [size, size],
    iconAnchor: [anchor, anchor],
  })
}

/**
 * Leaflet map with clustered markers.
 *
 * Imperative rather than declarative: Leaflet owns its own DOM, so React must not
 * try to reconcile inside the container. Markers are diffed against the previous
 * render and the cluster layer is rebuilt only when the set actually changes.
 *
 * Loaded via `next/dynamic` with `ssr: false` by callers — Leaflet touches
 * `window` at import time and cannot run on the server.
 */
export function LeafletMap({
  markers,
  selectedId,
  onSelect,
  className,
  ariaLabel,
}: {
  markers: MapMarker[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  className?: string
  ariaLabel: string
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const mapRef = React.useRef<L.Map | null>(null)
  const clusterRef = React.useRef<L.MarkerClusterGroup | null>(null)
  const markerIndex = React.useRef(new Map<string, L.Marker>())

  const onSelectRef = React.useRef(onSelect)
  React.useEffect(() => {
    onSelectRef.current = onSelect
  })

  React.useEffect(() => {
    const container = containerRef.current
    if (!container || mapRef.current) return

    const map = L.map(container, {
      center: CAMBODIA_CENTRE,
      zoom: COUNTRY_ZOOM,
      scrollWheelZoom: false,
      attributionControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    const cluster = L.markerClusterGroup({ showCoverageOnHover: false })
    map.addLayer(cluster)

    mapRef.current = map
    clusterRef.current = cluster
    const index = markerIndex.current

    return () => {
      map.remove()
      mapRef.current = null
      clusterRef.current = null
      index.clear()
    }
  }, [])

  // Rebuild markers whenever the set changes.
  React.useEffect(() => {
    const cluster = clusterRef.current
    const map = mapRef.current
    if (!cluster || !map) return

    cluster.clearLayers()
    markerIndex.current.clear()

    for (const marker of markers) {
      const isSelected = marker.id === selectedId
      const instance = L.marker([marker.latitude, marker.longitude], {
        icon: pinIcon(marker.kind, isSelected),
        title: marker.label,
        alt: marker.label,
        keyboard: true,
      })
      instance.on('click keypress', () => onSelectRef.current?.(marker.id))
      instance.bindTooltip(marker.label, { direction: 'top' })
      cluster.addLayer(instance)
      markerIndex.current.set(marker.id, instance)
    }

    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers.map((m) => [m.latitude, m.longitude]))
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 })
    }
  }, [markers, selectedId])

  // Pan to the externally selected marker so list and map stay in step.
  React.useEffect(() => {
    if (!selectedId) return
    const map = mapRef.current
    const marker = markerIndex.current.get(selectedId)
    if (!map || !marker) return

    map.panTo(marker.getLatLng(), { animate: true, duration: 0.5 })
    marker.openTooltip()
  }, [selectedId])

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label={ariaLabel}
      className={cn('h-full w-full rounded-[24px]', className)}
    />
  )
}
