import type { ContentItem } from '@/stores/vibe-booking.store'
// MapView requires Leaflet — render a placeholder until react-leaflet is installed
interface Props { item: ContentItem; onAction: (t: string, id?: string, p?: Record<string, unknown>) => void }
export default function MapViewRenderer({ item }: Props) {
  const { center, markers } = item.data as { center: { lat: number; lng: number }; markers?: Array<{ lat: number; lng: number; label?: string }> }
  return (
    <div className="p-4">
      <div className="rounded-lg bg-muted h-48 flex items-center justify-center text-sm text-muted-foreground">
        <div className="text-center">
          <p>📍 Map View</p>
          <p className="text-xs mt-1">{center.lat.toFixed(4)}, {center.lng.toFixed(4)}</p>
          {markers && <p className="text-xs">{markers.length} location{markers.length !== 1 ? 's' : ''}</p>}
          <p className="text-xs mt-2 opacity-60">Interactive map loads when Leaflet is installed</p>
        </div>
      </div>
    </div>
  )
}
