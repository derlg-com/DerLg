'use client'

import { Car } from 'lucide-react'
import { EntityCard } from '@/components/shared/EntityCard'
import { useTranslations, useLanguageStore } from '@/lib/i18n'
import { useCurrency } from '@/hooks/use-currency'
import { formatCurrency } from '@/lib/format'
import type { VehicleSummary } from '@/types/catalog'

export function VehicleCard({ vehicle }: { vehicle: VehicleSummary }) {
  const t = useTranslations('transportation')
  const locale = useLanguageStore((s) => s.locale)
  const currency = useCurrency()

  return (
    <EntityCard
      href={`/transportation/${vehicle.id}`}
      title={vehicle.name}
      favorite={{ type: 'transport', id: vehicle.id }}
      imageUrl={vehicle.imageUrls?.[0]}
      fallbackIcon={Car}
      badge={vehicle.type ? { label: vehicle.type } : undefined}
      rating={
        vehicle.ratingAverage != null && (vehicle.ratingCount ?? 0) > 0
          ? { average: vehicle.ratingAverage, count: vehicle.ratingCount }
          : undefined
      }
      meta={t('card.seats', { n: vehicle.capacity })}
      priceLabel={formatCurrency(vehicle.pricePerDayUsd, locale, currency)}
      priceSuffix={t('card.perDay')}
    />
  )
}
