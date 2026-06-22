'use client'

import { MapPin } from 'lucide-react'
import { EntityCard } from '@/components/shared/EntityCard'
import { useTranslations, useLanguageStore } from '@/lib/i18n'
import { useCurrency } from '@/hooks/use-currency'
import { formatCurrency } from '@/lib/format'
import type { HotelSummary } from '@/types/catalog'

export function HotelCard({ hotel }: { hotel: HotelSummary }) {
  const t = useTranslations('hotels')
  const locale = useLanguageStore((s) => s.locale)
  const currency = useCurrency()

  return (
    <EntityCard
      href={`/hotels/${hotel.slug ?? hotel.id}`}
      title={hotel.name}
      favorite={{ type: 'hotel', id: hotel.id }}
      imageUrl={hotel.coverImageUrl}
      fallbackIcon={MapPin}
      badge={hotel.starRating ? { label: `${hotel.starRating}★` } : undefined}
      rating={
        hotel.ratingAverage != null && (hotel.ratingCount ?? 0) > 0
          ? { average: hotel.ratingAverage, count: hotel.ratingCount }
          : undefined
      }
      subtitle={hotel.location ?? undefined}
      priceLabel={
        hotel.pricePerNightFrom != null
          ? formatCurrency(hotel.pricePerNightFrom, locale, currency)
          : undefined
      }
      priceSuffix={hotel.pricePerNightFrom != null ? t('card.perNight') : undefined}
    />
  )
}
