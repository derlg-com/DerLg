'use client'

import { CalendarDays, MapPin, ListChecks } from 'lucide-react'
import Link from 'next/link'
import { useApiQuery } from '@/lib/use-api-query'
import { TripGallery } from '@/components/trips/TripGallery'
import { ShareButton } from '@/components/shared/ShareButton'
import { FavoriteButton } from '@/components/shared/FavoriteButton'
import { TripCard } from '@/components/trips/TripCard'
import { HotelCard } from '@/components/hotels/HotelCard'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { useTranslations, useLanguageStore } from '@/lib/i18n'
import { formatDateShort } from '@/lib/format'
import { useFestivalRelated } from '@/hooks/use-festival-related'
import { FestivalCountdown } from './FestivalCountdown'
import { FestivalReminderToggle } from './FestivalReminderToggle'
import type { FestivalDetail } from '@/types/domain'

/**
 * Festival detail page (Requirement 3.3 / 4.6 + enhancements 41.4/41.6/41.7/
 * 41.8). Shows the festival name, locale-aware date range, location, an
 * upcoming-festival countdown, a favorite button + reminder toggle, gallery,
 * description, an activities list, and related trips/accommodations.
 */
export function FestivalDetailView({ id }: { id: string }) {
  const t = useTranslations('festivals')
  const locale = useLanguageStore((s) => s.locale)
  const { data: f, isLoading, error, refetch } = useApiQuery<FestivalDetail>(`/v1/festivals/${id}`)
  // Related content (Requirement 41.6). Assumed endpoint; degrades gracefully.
  const related = useFestivalRelated(id)

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (error || !f) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState
          icon={CalendarDays}
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

  const start = formatDateShort(f.startDate, locale)
  const end = formatDateShort(f.endDate, locale)
  const dateRange = start === end ? start : `${start} – ${end}`
  const place = f.location ?? f.province ?? undefined
  const activities = f.activities ?? []
  const relatedTrips = related.data?.trips ?? []
  const relatedHotels = related.data?.hotels ?? []

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-4 pb-24">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            {f.name}
          </h1>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
            {dateRange}
          </p>
          {place ? (
            <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden />
              {place}
            </p>
          ) : null}
          <div className="mt-2">
            <FestivalCountdown startDate={f.startDate} />
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <FavoriteButton type="festival" id={f.id} />
          <ShareButton title={f.name} entity="festival" />
        </div>
      </div>

      <FestivalReminderToggle festivalId={f.id} festivalName={f.name} startDate={f.startDate} />

      {f.images && f.images.length > 0 ? <TripGallery images={f.images} alt={f.name} /> : null}

      {f.description ? (
        <section className="space-y-2">
          <h2 className="font-display text-lg font-semibold text-foreground">
            {t('detail.about')}
          </h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {f.description}
          </p>
        </section>
      ) : null}

      {activities.length > 0 ? (
        <section className="space-y-2">
          <h2 className="flex items-center gap-1.5 font-display text-lg font-semibold text-foreground">
            <ListChecks className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            {t('detail.activities')}
          </h2>
          <ul className="space-y-1.5">
            {activities.map((activity, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                {activity}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {relatedTrips.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-foreground">
              {t('detail.relatedTrips')}
            </h2>
            <Link href="/trips" className="text-sm font-medium text-primary hover:underline">
              {t('detail.seeAll')}
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {relatedTrips.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        </section>
      ) : null}

      {relatedHotels.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-foreground">
              {t('detail.relatedHotels')}
            </h2>
            <Link href="/hotels" className="text-sm font-medium text-primary hover:underline">
              {t('detail.seeAll')}
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {relatedHotels.map((hotel) => (
              <HotelCard key={hotel.id} hotel={hotel} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
