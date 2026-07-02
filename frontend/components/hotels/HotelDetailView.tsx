'use client'

import { MapPin, Star, Check, Clock } from 'lucide-react'
import { useApiQuery } from '@/lib/use-api-query'
import { TripGallery } from '@/components/trips/TripGallery'
import { RoomCard } from './RoomCard'
import { GoogleMapView } from '@/components/shared/GoogleMapView'
import { FavoriteButton } from '@/components/shared/FavoriteButton'
import { ShareButton } from '@/components/shared/ShareButton'
import { CurrencySelector } from '@/components/trips/CurrencySelector'
import { CurrencyDisclaimer } from '@/components/trips/CurrencyDisclaimer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { useTranslations } from '@/lib/i18n'
import type { HotelDetail, HotelRoom } from '@/types/catalog'
import type { Paginated } from '@/types/api'

export function HotelDetailView({ id }: { id: string }) {
  const t = useTranslations('hotels')
  const { data: hotel, isLoading, error, refetch } = useApiQuery<HotelDetail>(`/v1/hotels/${id}`)
  const { data: roomsData } = useApiQuery<HotelRoom[] | Paginated<HotelRoom>>(
    `/v1/hotels/${id}/rooms`,
  )

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
        <Skeleton className="aspect-[4/3] w-full rounded-lg" />
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (error || !hotel) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState
          icon={MapPin}
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

  const rooms: HotelRoom[] = roomsData
    ? Array.isArray(roomsData)
      ? roomsData
      : roomsData.items
    : (hotel.rooms ?? [])
  const hotelHref = `/hotels/${hotel.slug ?? hotel.id}`
  const galleryImages =
    hotel.galleryImageUrls && hotel.galleryImageUrls.length > 0
      ? hotel.galleryImageUrls
      : hotel.coverImageUrl
        ? [hotel.coverImageUrl]
        : []

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-4">
      <TripGallery images={galleryImages} alt={hotel.name} />

      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
              {hotel.name}
            </h1>
            <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" aria-hidden />
              {hotel.address ?? hotel.location}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <FavoriteButton type="hotel" id={hotel.id} />
            <ShareButton title={hotel.name} entity="hotel" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {hotel.starRating ? (
            <span className="inline-flex items-center gap-0.5">
              {hotel.starRating}
              <Star className="h-4 w-4 fill-rating text-rating" aria-hidden />
            </span>
          ) : null}
          {hotel.ratingAverage != null && hotel.ratingCount > 0 ? (
            <span className="text-muted-foreground">
              {hotel.ratingAverage.toFixed(1)} ({hotel.ratingCount})
            </span>
          ) : null}
        </div>
      </div>

      {hotel.description ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{hotel.description}</p>
      ) : null}

      <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{t('detail.currency')}</p>
          <CurrencySelector className="w-28" />
        </div>
        <CurrencyDisclaimer />
      </div>

      {hotel.amenities && hotel.amenities.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-display text-lg font-semibold text-foreground">
            {t('detail.amenities')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {hotel.amenities.map((a) => (
              <Badge key={a} variant="muted">
                <Check className="h-3 w-3" aria-hidden /> {a}
              </Badge>
            ))}
          </div>
        </section>
      ) : null}

      {hotel.checkInTime || hotel.checkOutTime || hotel.cancellationPolicy ? (
        <section className="space-y-2">
          <h2 className="font-display text-lg font-semibold text-foreground">
            {t('detail.policies')}
          </h2>
          <div className="space-y-1 text-sm text-muted-foreground">
            {hotel.checkInTime ? (
              <p className="inline-flex items-center gap-1">
                <Clock className="h-4 w-4" aria-hidden /> {t('detail.checkIn')}: {hotel.checkInTime}
              </p>
            ) : null}
            {hotel.checkOutTime ? (
              <p className="inline-flex items-center gap-1">
                <Clock className="h-4 w-4" aria-hidden /> {t('detail.checkOut')}:{' '}
                {hotel.checkOutTime}
              </p>
            ) : null}
            {hotel.cancellationPolicy ? <p>{hotel.cancellationPolicy}</p> : null}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-foreground">{t('detail.rooms')}</h2>
        {rooms.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('detail.noRooms')}</p>
        ) : (
          <div className="space-y-3">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} hotelHref={hotelHref} />
            ))}
          </div>
        )}
      </section>

      {hotel.latitude != null && hotel.longitude != null ? (
        <section className="space-y-2">
          <h2 className="font-display text-lg font-semibold text-foreground">
            {t('detail.location')}
          </h2>
          <GoogleMapView lat={hotel.latitude} lng={hotel.longitude} label={hotel.name} />
        </section>
      ) : null}
    </div>
  )
}
