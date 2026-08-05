'use client'

import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'

import { CardMedia } from '@/components/shared/card-media'
import { Badge, Sheet, Skeleton } from '@/components/ui'
import { queryKeys } from '@/lib/api/query-keys'
import { placesApi } from '@/lib/api/resources'
import type { Locale } from '@/lib/i18n/config'
import { Link } from '@/lib/i18n/navigation'

/**
 * Place detail sheet, opened from the explore list or a map marker.
 *
 * A sheet rather than a route change so the user keeps their place on the map.
 * The deep link still works because the selected id lives in the query string.
 */
export function PlaceSheet({
  placeId,
  onClose,
}: {
  placeId: string | null
  onClose: () => void
}) {
  const locale = useLocale() as Locale
  const explore = useTranslations('explore')
  const catalog = useTranslations('catalog')
  const shell = useTranslations('shell')

  const { data: place, isPending } = useQuery({
    queryKey: queryKeys.places.detail(locale, placeId ?? ''),
    queryFn: ({ signal }) => placesApi.detail(placeId!, { locale, signal }),
    enabled: Boolean(placeId),
  })

  const { data: nearbyTrips } = useQuery({
    queryKey: queryKeys.places.nearbyTrips(locale, placeId ?? ''),
    queryFn: ({ signal }) => placesApi.nearbyTrips(placeId!, { locale, signal }),
    enabled: Boolean(placeId),
  })

  const open = Boolean(placeId)

  return (
    <Sheet
      open={open}
      onClose={onClose}
      side="bottom"
      title={place?.name ?? shell('nav.places')}
      description={place?.address ?? undefined}
    >
      {isPending || !place ? (
        <div className="space-y-3">
          <Skeleton className="aspect-video w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : (
        <div className="space-y-5">
          {place.images?.[0] ? (
            <CardMedia
              src={place.images[0]}
              ratio="16/9"
              sizes="(min-width: 640px) 32rem, 100vw"
              className="rounded-lg"
            />
          ) : null}

          <div className="flex flex-wrap gap-2">
            {place.category ? <Badge tone="accent">{place.category}</Badge> : null}
            <Badge tone={place.entryFeeUsd === 0 ? 'success' : 'neutral'}>
              {place.entryFeeUsd === 0
                ? catalog('detail.free')
                : `${catalog('detail.entryFee')}: $${place.entryFeeUsd}`}
            </Badge>
          </div>

          {place.description ? (
            <p className="text-sm text-[var(--text-secondary)]">{place.description}</p>
          ) : null}

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {place.openingHours ? (
              <div>
                <dt className="text-[var(--text-tertiary)]">{catalog('detail.openingHours')}</dt>
                <dd>{place.openingHours}</dd>
              </div>
            ) : null}
            {place.dressCode ? (
              <div>
                <dt className="text-[var(--text-tertiary)]">{explore('map.dressCode')}</dt>
                <dd>{place.dressCode}</dd>
              </div>
            ) : null}
          </dl>

          {place.visitorTips ? (
            <section className="space-y-1">
              <h3 className="text-sm font-medium">{explore('map.tips')}</h3>
              <p className="text-sm text-[var(--text-secondary)]">{place.visitorTips}</p>
            </section>
          ) : null}

          {place.website ? (
            <a
              href={place.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex text-sm font-medium text-[var(--accent)] hover:underline"
            >
              {explore('map.website')}
            </a>
          ) : null}

          {nearbyTrips && nearbyTrips.length > 0 ? (
            <section className="space-y-2">
              <h3 className="text-sm font-medium">{catalog('detail.nearbyTrips')}</h3>
              <ul className="space-y-2">
                {nearbyTrips.slice(0, 3).map((trip) => (
                  <li key={trip.id}>
                    <Link
                      href={`/trips/${trip.id}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-[var(--border-subtle)] p-3 text-sm hover:bg-[var(--surface-hover)]"
                    >
                      <span className="truncate">{trip.name}</span>
                      <span className="shrink-0 text-[var(--text-tertiary)]">
                        ${trip.priceUsd}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </Sheet>
  )
}
