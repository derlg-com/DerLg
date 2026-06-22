'use client'

import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Star } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { FavoriteButton } from '@/components/shared/FavoriteButton'
import { useTranslations, useLanguageStore } from '@/lib/i18n'
import { useCurrency } from '@/hooks/use-currency'
import { formatCurrency } from '@/lib/format'
import type { HotelSummary } from '@/types/catalog'

export function HotelCard({ hotel }: { hotel: HotelSummary }) {
  const t = useTranslations('hotels')
  const locale = useLanguageStore((s) => s.locale)
  const currency = useCurrency()
  const href = `/hotels/${hotel.slug ?? hotel.id}`

  return (
    <Link href={href} className="group block focus-visible:outline-none">
      <Card className="h-full overflow-hidden transition-shadow group-hover:shadow-md">
        <div className="relative aspect-[4/3] bg-muted">
          {hotel.coverImageUrl ? (
            <Image
              src={hotel.coverImageUrl}
              alt={hotel.name}
              fill
              sizes="(max-width: 640px) 50vw, 300px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <MapPin className="h-8 w-8" aria-hidden />
            </div>
          )}
          <div className="absolute right-2 top-2">
            <FavoriteButton type="hotel" id={hotel.id} />
          </div>
          {hotel.starRating ? (
            <span className="absolute left-2 top-2 inline-flex items-center gap-0.5 rounded-full bg-background/90 px-2 py-0.5 text-xs font-medium text-foreground backdrop-blur">
              {hotel.starRating}
              <Star className="h-3 w-3 fill-rating text-rating" aria-hidden />
            </span>
          ) : null}
        </div>
        <div className="space-y-1 p-3">
          <h3 className="line-clamp-1 font-medium text-foreground">{hotel.name}</h3>
          {hotel.location ? (
            <p className="line-clamp-1 text-xs text-muted-foreground">{hotel.location}</p>
          ) : null}
          {hotel.ratingAverage != null && hotel.ratingCount > 0 ? (
            <span className="inline-flex items-center gap-0.5 text-xs text-foreground">
              <Star className="h-3.5 w-3.5 fill-rating text-rating" aria-hidden />
              {hotel.ratingAverage.toFixed(1)}
              <span className="text-muted-foreground">({hotel.ratingCount})</span>
            </span>
          ) : null}
          {hotel.pricePerNightFrom != null ? (
            <p className="pt-1 text-sm">
              <span className="text-xs text-muted-foreground">{t('card.from')} </span>
              <span className="font-semibold text-foreground">
                {formatCurrency(hotel.pricePerNightFrom, locale, currency)}
              </span>{' '}
              <span className="text-xs text-muted-foreground">{t('card.perNight')}</span>
            </p>
          ) : null}
        </div>
      </Card>
    </Link>
  )
}
