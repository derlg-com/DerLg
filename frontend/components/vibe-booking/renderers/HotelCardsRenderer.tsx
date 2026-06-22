'use client'
import { useState } from 'react'
import type { ContentItem } from '@/stores/vibe-booking.store'
import { useLanguageStore, useTranslations } from '@/lib/i18n'
import { formatCurrency } from '@/lib/format'
import SyncedResultsMap, { type MapPoint } from '@/components/vibe-booking/SyncedResultsMap'
import ResultCard from '@/components/vibe-booking/ResultCard'

interface Props {
  item: ContentItem
  onAction: (t: string, id?: string, p?: Record<string, unknown>) => void
}

interface HotelData {
  id: string
  name: string
  priceUsd: number
  rating?: number
  reviewCount?: number
  imageUrl?: string
  amenities?: string[]
  description?: string
  blurb?: string
  lat?: number
  lng?: number
}

export default function HotelCardsRenderer({ item, onAction }: Props) {
  const locale = useLanguageStore((s) => s.locale)
  const t = useTranslations()
  const { hotels } = item.data as { hotels: HotelData[] }
  const [highlightedId, setHighlightedId] = useState<string | null>(null)

  const points: MapPoint[] = hotels
    .filter((h) => h.lat != null && h.lng != null)
    .map((h) => ({ id: h.id, lat: h.lat as number, lng: h.lng as number, label: h.name, price: h.priceUsd }))

  return (
    <div className="space-y-3 p-4">
      {points.length > 0 && (
        <SyncedResultsMap points={points} highlightedId={highlightedId} onHighlight={setHighlightedId} />
      )}
      <div className="space-y-3">
        {hotels.map((h) => (
          <ResultCard
            key={h.id}
            favType="hotel"
            id={h.id}
            name={h.name}
            imageUrl={h.imageUrl}
            rating={h.rating}
            reviewCount={h.reviewCount}
            subtitle={h.amenities ? h.amenities.slice(0, 3).join(' · ') : undefined}
            priceLabel={formatCurrency(h.priceUsd, locale)}
            priceSuffix={t('hotel.perNight')}
            blurb={h.blurb ?? h.description}
            highlighted={highlightedId === h.id}
            onHoverChange={(hovering) =>
              setHighlightedId((cur) => (hovering ? h.id : cur === h.id ? null : cur))
            }
            primaryLabel={t('content.checkAvailability')}
            onPrimary={() => onAction('view_hotel', h.id, { hotelId: h.id })}
            secondaryLabel={t('content.findMoreLikeThis')}
            onSecondary={() => onAction('find_more_like_this', h.id, { name: h.name, kind: 'hotel' })}
          />
        ))}
      </div>
    </div>
  )
}
