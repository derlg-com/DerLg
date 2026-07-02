'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { MapPin, Clock, Shirt, Globe, Lightbulb, Navigation, AlertTriangle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TripGallery } from '@/components/trips/TripGallery'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useApiQuery } from '@/lib/use-api-query'
import { useTranslations, useLanguageStore, type Locale } from '@/lib/i18n'
import { useCurrency } from '@/hooks/use-currency'
import { formatCurrency } from '@/lib/format'
import type { Currency } from '@/types/api'
import type { PlaceDetail } from '@/types/domain'

/**
 * Place detail modal (task 8.5 / Requirement 4.6). Opens whenever a `?place=<id>`
 * query param is present on the Explore page — the Places tab cards link with
 * that param appended (see {@link PlacesTab} `hrefFor`) so the modal is fully
 * URL-driven, shareable, and survives reload.
 *
 * Fetches `GET /v1/places/:id` → {@link PlaceDetail} through the shared
 * {@link useApiQuery} layer (only while a place id is present) and renders the
 * full information via the existing {@link Dialog} (focus trap, Esc, overlay
 * click, scroll lock): gallery, category, entry fee, opening hours, dress code,
 * address, visitor tips, website, plus a "Get directions" CTA to the place's
 * map location (OpenStreetMap). Loading shows a skeleton, with error/retry and
 * not-found states.
 *
 * Closing removes only the `?place=` param, preserving the active tab, filters,
 * search query, and paging so the user returns to the same list state.
 *
 * Festivals are NOT shown in a modal here: they have a full standalone detail
 * page (`/festivals/<id>`, task 7.3) that festival cards link to, which already
 * satisfies the festival side of Requirement 4.6. Mirroring it as a modal would
 * duplicate that surface, so the decision is to keep festivals on the page and
 * scope this modal to places (the only Explore entity without its own route).
 */
export function PlaceDetailModal() {
  const t = useTranslations('explore.places.modal')
  const locale = useLanguageStore((s) => s.locale)
  const currency = useCurrency()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const placeId = params.get('place')
  const open = Boolean(placeId)

  const {
    data: place,
    isLoading,
    error,
    refetch,
  } = useApiQuery<PlaceDetail>(placeId ? `/v1/places/${placeId}` : null)

  const close = () => {
    const next = new URLSearchParams(params.toString())
    next.delete('place')
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  const onOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) close()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" aria-busy={isLoading}>
        {isLoading ? (
          <div className="space-y-4" data-testid="place-modal-loading">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-44 w-full rounded-lg" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : error || !place ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertTriangle className="h-8 w-8 text-muted-foreground" aria-hidden />
            <DialogHeader className="items-center pr-0">
              <DialogTitle>{error?.status === 404 ? t('notFound') : t('error.title')}</DialogTitle>
            </DialogHeader>
            {error?.status === 404 ? null : (
              <>
                <p className="text-sm text-muted-foreground">{t('error.desc')}</p>
                <Button variant="outline" size="sm" onClick={refetch}>
                  {t('error.retry')}
                </Button>
              </>
            )}
          </div>
        ) : (
          <PlaceDetailBody place={place} t={t} locale={locale} currency={currency} />
        )}
      </DialogContent>
    </Dialog>
  )
}

interface PlaceDetailBodyProps {
  place: PlaceDetail
  t: ReturnType<typeof useTranslations>
  locale: Locale
  currency: Currency
}

function PlaceDetailBody({ place, t, locale, currency }: PlaceDetailBodyProps) {
  const free = place.entryFeeUsd == null || place.entryFeeUsd <= 0
  const priceLabel = free
    ? t('free')
    : formatCurrency(place.entryFeeUsd as number, locale, currency)

  // OpenStreetMap location link — matches the project's Leaflet/OSM map stack.
  const directionsHref = `https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=16/${place.latitude}/${place.longitude}`

  return (
    <div className="space-y-5">
      <DialogHeader>
        <DialogTitle className="text-xl">{place.name}</DialogTitle>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            {t(`category.${place.category}`, undefined, 'category.unknown')}
          </span>
          <span className="font-medium text-foreground">
            {priceLabel}
            {free ? null : (
              <span className="font-normal text-muted-foreground"> {t('entryFee')}</span>
            )}
          </span>
        </p>
      </DialogHeader>

      {place.images && place.images.length > 0 ? (
        <TripGallery images={place.images} alt={place.name} />
      ) : null}

      {place.description ? (
        <section className="space-y-1.5">
          <h3 className="font-display text-base font-semibold text-foreground">{t('about')}</h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {place.description}
          </p>
        </section>
      ) : null}

      <dl className="grid gap-3 sm:grid-cols-2">
        {place.address ? (
          <DetailRow icon={MapPin} label={t('address')} value={place.address} />
        ) : null}
        {place.openingHours ? (
          <DetailRow icon={Clock} label={t('openingHours')} value={place.openingHours} />
        ) : null}
        {place.dressCode ? (
          <DetailRow icon={Shirt} label={t('dressCode')} value={place.dressCode} />
        ) : null}
        {place.visitorTips ? (
          <DetailRow icon={Lightbulb} label={t('visitorTips')} value={place.visitorTips} />
        ) : null}
      </dl>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild className="sm:flex-1">
          <a href={directionsHref} target="_blank" rel="noopener noreferrer">
            <Navigation className="mr-2 h-4 w-4" aria-hidden />
            {t('directions')}
          </a>
        </Button>
        {place.website ? (
          <Button asChild variant="outline" className="sm:flex-1">
            <a href={place.website} target="_blank" rel="noopener noreferrer">
              <Globe className="mr-2 h-4 w-4" aria-hidden />
              {t('website')}
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin
  label: string
  value: string
}) {
  return (
    <div className="flex gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </dt>
        <dd className="text-sm text-foreground">{value}</dd>
      </div>
    </div>
  )
}
