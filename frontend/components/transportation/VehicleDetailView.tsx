'use client'

import { Users, Car, Star, Check } from 'lucide-react'
import { useApiQuery } from '@/lib/use-api-query'
import { TripGallery } from '@/components/trips/TripGallery'
import { AvailabilityChecker } from './AvailabilityChecker'
import { BookNowCTA } from '@/components/trips/BookNowCTA'
import { GoogleMapView } from '@/components/shared/GoogleMapView'
import { FavoriteButton } from '@/components/shared/FavoriteButton'
import { ShareButton } from '@/components/shared/ShareButton'
import { CurrencySelector } from '@/components/trips/CurrencySelector'
import { CurrencyDisclaimer } from '@/components/trips/CurrencyDisclaimer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { useTranslations, useLanguageStore } from '@/lib/i18n'
import { useCurrency } from '@/hooks/use-currency'
import { formatCurrency } from '@/lib/format'
import type { VehicleDetail } from '@/types/catalog'

export function VehicleDetailView({ id }: { id: string }) {
  const t = useTranslations('transportation')
  const locale = useLanguageStore((s) => s.locale)
  const currency = useCurrency()
  const {
    data: v,
    isLoading,
    error,
    refetch,
  } = useApiQuery<VehicleDetail>(`/v1/transportation/vehicles/${id}`)

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
        <Skeleton className="aspect-[4/3] w-full rounded-lg" />
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (error || !v) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState
          icon={Car}
          title={error?.status === 404 ? t('detail.notFound') : t('error.title')}
          description={error?.status === 404 ? undefined : t('error.desc')}
          action={
            error?.status === 404 ? undefined : (
              <Button variant="outline" size="sm" onClick={refetch}>
                {t('error.retry')}
              </Button>
            )
          }
        />
      </div>
    )
  }

  const galleryImages = v.imageUrls ?? []

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-4 pb-36">
      <TripGallery images={galleryImages} alt={v.name} />

      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
              {v.name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
              {v.type ? <Badge variant="secondary">{v.type}</Badge> : null}
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Users className="h-4 w-4" aria-hidden />
                {t('card.seats', { n: v.capacity })}
              </span>
              {v.ratingAverage != null && v.ratingCount > 0 ? (
                <span className="inline-flex items-center gap-0.5">
                  <Star className="h-4 w-4 fill-rating text-rating" aria-hidden />
                  {v.ratingAverage.toFixed(1)}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <FavoriteButton type="transport" id={v.id} />
            <ShareButton title={v.name} entity="transport" />
          </div>
        </div>
      </div>

      {v.description ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{v.description}</p>
      ) : null}

      <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{t('detail.currency')}</p>
          <CurrencySelector className="w-28" />
        </div>
        <CurrencyDisclaimer />
      </div>

      {v.amenities && v.amenities.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-display text-lg font-semibold text-foreground">
            {t('detail.amenities')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {v.amenities.map((a) => (
              <Badge key={a} variant="muted">
                <Check className="h-3 w-3" aria-hidden /> {a}
              </Badge>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold text-foreground">
          {t('detail.pricing')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('card.perDay')}: {formatCurrency(v.pricePerDayUsd, locale, currency)}
          {v.pricePerKmUsd != null
            ? ` · ${t('detail.perKm')}: ${formatCurrency(v.pricePerKmUsd, locale, currency)}`
            : ''}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold text-foreground">
          {t('detail.availability')}
        </h2>
        <AvailabilityChecker vehicleId={v.id} />
      </section>

      {v.latitude != null && v.longitude != null ? (
        <section className="space-y-2">
          <h2 className="font-display text-lg font-semibold text-foreground">
            {t('detail.route')}
          </h2>
          <GoogleMapView lat={v.latitude} lng={v.longitude} label={v.name} />
        </section>
      ) : null}

      <BookNowCTA href={`/transportation/${v.id}/book`} priceUsd={v.pricePerDayUsd} />
    </div>
  )
}
