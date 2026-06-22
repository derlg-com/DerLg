'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Clock, MapPin, Star } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { FavoriteButton } from '@/components/shared/FavoriteButton'
import { useTranslations, useLanguageStore } from '@/lib/i18n'
import { useCurrency } from '@/hooks/use-currency'
import { formatCurrency } from '@/lib/format'
import type { TripSummary } from '@/types/catalog'

export function TripCard({ trip }: { trip: TripSummary }) {
  const t = useTranslations('trips')
  const locale = useLanguageStore((s) => s.locale)
  const currency = useCurrency()
  const href = `/trips/${trip.slug ?? trip.id}`

  return (
    <Link href={href} className="group block focus-visible:outline-none">
      <Card className="h-full overflow-hidden transition-shadow group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-ring">
        <div className="relative aspect-[4/3] bg-muted">
          {trip.coverImageUrl ? (
            <Image
              src={trip.coverImageUrl}
              alt={trip.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <MapPin className="h-8 w-8" aria-hidden />
            </div>
          )}
          <div className="absolute right-2 top-2">
            <FavoriteButton type="trip" id={trip.id} />
          </div>
          {trip.category ? (
            <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-xs font-medium text-foreground backdrop-blur">
              {trip.category}
            </span>
          ) : null}
        </div>
        <div className="space-y-1 p-3">
          <h3 className="line-clamp-1 font-medium text-foreground">{trip.name}</h3>
          {trip.location ? (
            <p className="line-clamp-1 text-xs text-muted-foreground">{trip.location}</p>
          ) : null}
          <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              {trip.durationDays} {t('card.days')}
            </span>
            {trip.ratingAverage != null && trip.ratingCount > 0 ? (
              <span className="inline-flex items-center gap-0.5 text-foreground">
                <Star className="h-3.5 w-3.5 fill-rating text-rating" aria-hidden />
                {trip.ratingAverage.toFixed(1)}
                <span className="text-muted-foreground">({trip.ratingCount})</span>
              </span>
            ) : null}
          </div>
          <p className="pt-1 text-sm">
            <span className="font-semibold text-foreground">
              {formatCurrency(trip.priceUsd, locale, currency)}
            </span>{' '}
            <span className="text-xs text-muted-foreground">{t('card.perPerson')}</span>
          </p>
        </div>
      </Card>
    </Link>
  )
}
