'use client'

import { MapPin } from 'lucide-react'
import { EntityCard } from '@/components/shared/EntityCard'
import { useTranslations, useLanguageStore } from '@/lib/i18n'
import { useCurrency } from '@/hooks/use-currency'
import { formatCurrency } from '@/lib/format'
import type { TripSummary } from '@/types/catalog'

export function TripCard({ trip }: { trip: TripSummary }) {
  const t = useTranslations('trips')
  const locale = useLanguageStore((s) => s.locale)
  const currency = useCurrency()

  return (
    <EntityCard
      href={`/trips/${trip.slug ?? trip.id}`}
      title={trip.name}
      favorite={{ type: 'trip', id: trip.id }}
      imageUrl={trip.coverImageUrl}
      fallbackIcon={MapPin}
      badge={trip.category ? { label: trip.category } : undefined}
      rating={
        trip.ratingAverage != null && (trip.ratingCount ?? 0) > 0
          ? { average: trip.ratingAverage, count: trip.ratingCount }
          : undefined
      }
      subtitle={trip.location ?? undefined}
      priceLabel={formatCurrency(trip.priceUsd, locale, currency)}
      priceSuffix={t('card.perPerson')}
      meta={`${trip.durationDays} ${t('card.days')}`}
    />
  )
}
