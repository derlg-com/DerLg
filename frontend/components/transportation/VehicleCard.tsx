'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Users, Car, Star } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FavoriteButton } from '@/components/shared/FavoriteButton'
import { useTranslations, useLanguageStore } from '@/lib/i18n'
import { useCurrency } from '@/hooks/use-currency'
import { formatCurrency } from '@/lib/format'
import type { VehicleSummary } from '@/types/catalog'

export function VehicleCard({ vehicle }: { vehicle: VehicleSummary }) {
  const t = useTranslations('transportation')
  const locale = useLanguageStore((s) => s.locale)
  const currency = useCurrency()
  const href = `/transportation/${vehicle.id}`
  const image = vehicle.imageUrls?.[0] ?? null

  return (
    <Link href={href} className="group block focus-visible:outline-none">
      <Card className="h-full overflow-hidden transition-shadow group-hover:shadow-md">
        <div className="relative aspect-[4/3] bg-muted">
          {image ? (
            <Image
              src={image}
              alt={vehicle.name}
              fill
              sizes="(max-width: 640px) 50vw, 300px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Car className="h-8 w-8" aria-hidden />
            </div>
          )}
          <div className="absolute right-2 top-2">
            <FavoriteButton type="transport" id={vehicle.id} />
          </div>
          {vehicle.type ? (
            <Badge variant="secondary" className="absolute left-2 top-2">
              {vehicle.type}
            </Badge>
          ) : null}
        </div>
        <div className="space-y-1 p-3">
          <h3 className="line-clamp-1 font-medium text-foreground">{vehicle.name}</h3>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" aria-hidden />
              {t('card.seats', { n: vehicle.capacity })}
            </span>
            {vehicle.ratingAverage != null && vehicle.ratingCount > 0 ? (
              <span className="inline-flex items-center gap-0.5 text-foreground">
                <Star className="h-3.5 w-3.5 fill-rating text-rating" aria-hidden />
                {vehicle.ratingAverage.toFixed(1)}
              </span>
            ) : null}
          </div>
          <p className="pt-1 text-sm">
            <span className="font-semibold text-foreground">
              {formatCurrency(vehicle.pricePerDayUsd, locale, currency)}
            </span>{' '}
            <span className="text-xs text-muted-foreground">{t('card.perDay')}</span>
          </p>
        </div>
      </Card>
    </Link>
  )
}
