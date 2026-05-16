import type { ContentItem } from '@/stores/vibe-booking.store'
interface Props { item: ContentItem; onAction: (t: string, id?: string, p?: Record<string, unknown>) => void }
export default function HotelCardsRenderer({ item, onAction }: Props) {
  const { hotels } = item.data as { hotels: Array<{ id: string; name: string; priceUsd: number; rating?: number; imageUrl?: string; amenities?: string[] }> }
  return (
    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
      {hotels.map((h) => (
        <div key={h.id} className="rounded-lg border overflow-hidden">
          {h.imageUrl && <img src={h.imageUrl} alt={h.name} className="w-full h-32 object-cover" />}
          <div className="p-3 space-y-1">
            <p className="font-semibold text-sm">{h.name}</p>
            <p className="text-xs text-muted-foreground">${h.priceUsd}/night{h.rating ? ` · ⭐ ${h.rating}` : ''}</p>
            {h.amenities && <p className="text-xs text-muted-foreground">{h.amenities.slice(0, 3).join(' · ')}</p>}
            <button onClick={() => onAction('view_hotel', h.id, { hotelId: h.id })} className="w-full text-xs border border-border rounded py-1 mt-1">View Details</button>
          </div>
        </div>
      ))}
    </div>
  )
}
