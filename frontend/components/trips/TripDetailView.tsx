'use client'

import { Clock, MapPin, Star } from 'lucide-react'
import { useApiQuery } from '@/lib/use-api-query'
import { TripGallery } from './TripGallery'
import { TripItinerary } from './TripItinerary'
import { TripInclusions } from './TripInclusions'
import { RelatedTrips } from './RelatedTrips'
import { BookNowCTA } from './BookNowCTA'
import { CurrencySelector } from './CurrencySelector'
import { GoogleMapView } from '@/components/shared/GoogleMapView'
import { FavoriteButton } from '@/components/shared/FavoriteButton'
import { ShareButton } from '@/components/shared/ShareButton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { useTranslations } from '@/lib/i18n'
import type { TripDetail } from '@/types/catalog'

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
      <Skeleton className="aspect-[4/3] w-full rounded-lg" />
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}

export function TripDetailView({ id }: { id: string }) {
  const t = useTranslations('trips')
  const { data: trip, isLoading, error, refetch } = useApiQuery<TripDetail>(`/v1/trips/${id}`)

  if (isLoading) return <DetailSkeleton />

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState
          icon={MapPin}
          title={error.status === 404 ? t('detail.notFound') : t('error.title')}
          description={error.status === 404 ? undefined : t('error.desc')}
          action={
            error.status === 404 ? undefined : (
              <Button variant="outline" size="sm" onClick={refetch}>
                {t('error.retry')}
              </Button>
            )
          }
        />
      </div>
    )
  }

  if (!trip) return null

  const bookHref = `/trips/${trip.slug ?? trip.id}/book`
  const galleryImages =
    trip.galleryImageUrls && trip.galleryImageUrls.length > 0
      ? trip.galleryImageUrls
      : trip.coverImageUrl
        ? [trip.coverImageUrl]
        : []

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-4 pb-36">
      <TripGallery images={galleryImages} alt={trip.name} />

      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">{trip.name}</h1>
            {trip.location ? (
              <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" aria-hidden />
                {trip.location}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-2">
            <FavoriteButton type="trip" id={trip.id} />
            <ShareButton title={trip.name} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {trip.category ? <Badge variant="secondary">{trip.category}</Badge> : null}
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Clock className="h-4 w-4" aria-hidden />
            {trip.durationDays} {t('card.days')}
          </span>
          {trip.ratingAverage != null && trip.ratingCount > 0 ? (
            <span className="inline-flex items-center gap-0.5">
              <Star className="h-4 w-4 fill-rating text-rating" aria-hidden />
              {trip.ratingAverage.toFixed(1)}
              <span className="text-muted-foreground">({trip.ratingCount})</span>
            </span>
          ) : null}
        </div>
      </div>

      {trip.description ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{trip.description}</p>
      ) : null}

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <p className="text-sm text-muted-foreground">{t('detail.currency')}</p>
        <CurrencySelector className="w-28" />
      </div>

      {trip.itineraryDays && trip.itineraryDays.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-foreground">{t('detail.itinerary')}</h2>
          <TripItinerary days={trip.itineraryDays} />
        </section>
      ) : null}

      <TripInclusions included={trip.includedItems ?? []} excluded={trip.excludedItems ?? []} />

      {trip.cancellationPolicy ? (
        <section className="space-y-2">
          <h2 className="font-display text-lg font-semibold text-foreground">{t('detail.cancellation')}</h2>
          <p className="text-sm text-muted-foreground">{trip.cancellationPolicy}</p>
        </section>
      ) : null}

      {trip.meetingPoint ? (
        <section className="space-y-2">
          <h2 className="font-display text-lg font-semibold text-foreground">{t('detail.meetingPoint')}</h2>
          <p className="text-sm text-muted-foreground">{trip.meetingPoint.description}</p>
          <GoogleMapView
            lat={trip.meetingPoint.latitude}
            lng={trip.meetingPoint.longitude}
            label={trip.name}
          />
        </section>
      ) : null}

      <RelatedTrips tripId={trip.id} />

      <BookNowCTA href={bookHref} priceUsd={trip.priceUsd} />
    </div>
  )
}
