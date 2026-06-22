'use client'
import { useState } from 'react'
import type { ContentItem } from '@/stores/vibe-booking.store'
import type { TripCardsPayloadSchema } from '@/schemas/vibe-booking'
import type { z } from 'zod'
import { useLanguageStore, useTranslations } from '@/lib/i18n'
import { formatCurrency } from '@/lib/format'
import SyncedResultsMap, { type MapPoint } from '@/components/vibe-booking/SyncedResultsMap'
import ResultCard from '@/components/vibe-booking/ResultCard'

interface Props {
  item: ContentItem
  onAction: (type: string, itemId?: string, payload?: Record<string, unknown>) => void
}

type Data = z.infer<typeof TripCardsPayloadSchema>['data']

export default function TripCardsRenderer({ item, onAction }: Props) {
  const locale = useLanguageStore((s) => s.locale)
  const t = useTranslations()
  const { trips } = item.data as Data
  const [highlightedId, setHighlightedId] = useState<string | null>(null)

  const points: MapPoint[] = trips
    .filter((tr) => tr.lat != null && tr.lng != null)
    .map((tr) => ({ id: tr.id, lat: tr.lat as number, lng: tr.lng as number, label: tr.name, price: tr.priceUsd }))

  return (
    <div className="space-y-3 p-4">
      {points.length > 0 && (
        <SyncedResultsMap points={points} highlightedId={highlightedId} onHighlight={setHighlightedId} />
      )}
      <div className="space-y-3">
        {trips.map((trip) => (
          <ResultCard
            key={trip.id}
            favType="trip"
            id={trip.id}
            name={trip.name}
            imageUrl={trip.imageUrl}
            rating={trip.rating}
            reviewCount={trip.reviewCount}
            subtitle={`${trip.durationDays} ${t('content.duration').toLowerCase()}`}
            priceLabel={formatCurrency(trip.priceUsd, locale)}
            priceSuffix={t('content.perPerson')}
            blurb={trip.blurb ?? trip.description}
            highlighted={highlightedId === trip.id}
            onHoverChange={(hovering) =>
              setHighlightedId((cur) => (hovering ? trip.id : cur === trip.id ? null : cur))
            }
            primaryLabel={t('content.checkAvailability')}
            onPrimary={() => onAction('view_trip_detail', trip.id, { tripId: trip.id })}
            secondaryLabel={t('content.findMoreLikeThis')}
            onSecondary={() => onAction('find_more_like_this', trip.id, { name: trip.name, kind: 'trip' })}
          />
        ))}
      </div>
    </div>
  )
}
