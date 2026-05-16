import type { ContentItem } from '@/types/vibe-booking'
import type { TripCardsPayloadSchema } from '@/schemas/vibe-booking'
import type { z } from 'zod'

interface Props {
  item: ContentItem
  onAction: (type: string, itemId?: string, payload?: Record<string, unknown>) => void
}

type Data = z.infer<typeof TripCardsPayloadSchema>['data']

export default function TripCardsRenderer({ item, onAction }: Props) {
  const { trips } = (item.payload as { type: 'trip_cards'; data: Data }).data
  return (
    <div className="p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {trips.map((trip) => (
          <div key={trip.id} className="rounded-lg border border-border overflow-hidden">
            {trip.imageUrl && (
              <img src={trip.imageUrl} alt={trip.name} className="w-full h-36 object-cover" />
            )}
            <div className="p-3 space-y-1">
              <p className="font-semibold text-sm">{trip.name}</p>
              <p className="text-xs text-muted-foreground">{trip.durationDays} days · ${trip.priceUsd}</p>
              {trip.rating && (
                <p className="text-xs text-muted-foreground">⭐ {trip.rating} ({trip.reviewCount})</p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => onAction('book_trip', trip.id, { tripId: trip.id })}
                  className="flex-1 text-xs bg-primary text-primary-foreground rounded-md py-1.5 font-medium"
                >
                  Book Now
                </button>
                <button
                  onClick={() => onAction('view_trip_detail', trip.id, { tripId: trip.id })}
                  className="flex-1 text-xs border border-border rounded-md py-1.5"
                >
                  Details
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
