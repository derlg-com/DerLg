'use client'

import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps'
import { MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MapPoint {
  id: string
  lat: number
  lng: number
  label?: string
  /** USD price shown as a pin label (TripAdvisor-style price pins). */
  price?: number
}

interface Props {
  points: MapPoint[]
  highlightedId: string | null
  onHighlight: (id: string | null) => void
  className?: string
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

/**
 * A results map that stays in sync with a list of cards: hovering/clicking a
 * card highlights its pin and vice-versa (TripAdvisor "Plan with AI" pattern).
 * Falls back to an accessible row of location chips when no Maps key is set, so
 * the sync behaviour (and the locations) still work without the Maps JS API.
 */
export default function SyncedResultsMap({ points, highlightedId, onHighlight, className }: Props) {
  if (points.length === 0) return null

  // Read at render time (not module load) so it stays test-controllable and
  // still gets statically inlined by Next in production builds.
  const apiKey = API_KEY || (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '')

  const center = {
    lat: points.reduce((sum, p) => sum + p.lat, 0) / points.length,
    lng: points.reduce((sum, p) => sum + p.lng, 0) / points.length,
  }

  if (!apiKey) {
    return (
      <div
        className={cn('rounded-lg border border-border bg-muted/40 p-2', className)}
        data-testid="synced-map-fallback"
      >
        <div className="flex flex-wrap gap-1.5">
          {points.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseEnter={() => onHighlight(p.id)}
              onMouseLeave={() => onHighlight(null)}
              onFocus={() => onHighlight(p.id)}
              onBlur={() => onHighlight(null)}
              onClick={() => onHighlight(p.id)}
              aria-pressed={highlightedId === p.id}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] transition-colors',
                highlightedId === p.id
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:bg-muted',
              )}
            >
              <MapPin size={12} aria-hidden /> {p.label ?? p.id}
              {p.price != null && <span className="font-semibold">· ${Math.round(p.price)}</span>}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('h-56 w-full overflow-hidden rounded-lg border border-border', className)}>
      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={center}
          defaultZoom={points.length === 1 ? 12 : 9}
          mapId="derlg-vibe-booking"
          gestureHandling="cooperative"
          disableDefaultUI
        >
          {points.map((p) => {
            const active = highlightedId === p.id
            return (
              <AdvancedMarker
                key={p.id}
                position={{ lat: p.lat, lng: p.lng }}
                title={p.label}
                zIndex={active ? 10 : 1}
                onClick={() => onHighlight(p.id)}
              >
                {p.price != null ? (
                  <div
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold shadow transition-colors ${
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-foreground'
                    }`}
                  >
                    ${Math.round(p.price)}
                  </div>
                ) : (
                  <Pin
                    scale={active ? 1.4 : 1}
                    background={active ? '#ef4444' : undefined}
                    borderColor={active ? '#b91c1c' : undefined}
                    glyphColor={active ? '#ffffff' : undefined}
                  />
                )}
              </AdvancedMarker>
            )
          })}
        </Map>
      </APIProvider>
    </div>
  )
}
