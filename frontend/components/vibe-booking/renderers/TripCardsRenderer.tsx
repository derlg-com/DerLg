'use client'
import Image from 'next/image'
import { MapPin } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import type { ContentItem } from '@/stores/vibe-booking.store'
import type { TripCardsPayloadSchema } from '@/schemas/vibe-booking'
import type { z } from 'zod'
import { useLanguageStore } from '@/lib/i18n'
import { useVibeBookingStore } from '@/stores/vibe-booking.store'
import { formatCurrency } from '@/lib/format'

interface Props {
  item: ContentItem
  onAction: (type: string, itemId?: string, payload?: Record<string, unknown>) => void
}

type Data = z.infer<typeof TripCardsPayloadSchema>['data']

export default function TripCardsRenderer({ item, onAction }: Props) {
  const locale = useLanguageStore((s) => s.locale)
  const addContentItem = useVibeBookingStore((s) => s.addContentItem)
  const { trips } = item.data as Data

  const showOnMap = (trip: Data['trips'][number]) => {
    if (trip.lat == null || trip.lng == null) return
    addContentItem({
      id: uuid(),
      type: 'map_view',
      data: {
        center: { lat: trip.lat, lng: trip.lng },
        markers: [{ id: trip.id, lat: trip.lat, lng: trip.lng, label: trip.name }],
      },
      actions: [],
      metadata: { title: trip.name },
      status: 'ready',
      timestamp: new Date().toISOString(),
    })
  }

  return (
    <div className="p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {trips.map((trip) => (
          <div key={trip.id} className="rounded-lg border border-border overflow-hidden">
            {trip.imageUrl && (
              <div className="relative w-full h-36">
                <Image
                  src={trip.imageUrl}
                  alt={trip.name}
                  fill
                  loading="lazy"
                  sizes="(min-width: 640px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
            )}
            <div className="p-3 space-y-1">
              <p className="font-semibold text-sm">{trip.name}</p>
              <p className="text-xs text-muted-foreground">{trip.durationDays} days · {formatCurrency(trip.priceUsd, locale)}</p>
              {trip.rating && (
                <p className="text-xs text-muted-foreground">⭐ {trip.rating} ({trip.reviewCount})</p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => onAction('book_trip', trip.id, { tripId: trip.id })}
                  className="flex-1 text-xs bg-primary text-primary-foreground rounded-md min-h-[44px] px-3 font-medium transition-colors hover:opacity-90 active:opacity-80"
                >
                  Book Now
                </button>
                <button
                  onClick={() => onAction('view_trip_detail', trip.id, { tripId: trip.id })}
                  className="flex-1 text-xs border border-border rounded-md min-h-[44px] px-3 transition-colors hover:bg-muted active:bg-muted/70"
                >
                  Details
                </button>
              </div>
              {trip.lat != null && trip.lng != null && (
                <button
                  onClick={() => showOnMap(trip)}
                  className="w-full text-xs text-primary hover:underline pt-1 inline-flex items-center gap-1 min-h-[44px] text-left"
                >
                  <MapPin size={14} aria-hidden /> Show on map
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
