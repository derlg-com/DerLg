'use client'

import { Compass } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'

import { DirectionsLink, GoogleMapsLink } from '@/components/chat/maps-links'
import { GalleryRail } from '@/components/chat/payloads/lightbox'
import { Price } from '@/components/shared/price'
import { Badge, Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import { Link } from '@/lib/i18n/navigation'
import { googleMapsDirectionsUrl, googleMapsPlaceUrl } from '@/lib/maps/google'
import { normalizeImageUrl, safeImageSrc } from '@/lib/url-safety'
import type { ContentPayload } from '@/schemas/vibe-payloads'

/**
 * Rich (non-card) content blocks: details, itineraries, galleries, weather,
 * budgets and plain summaries.
 *
 * These are all "one subject, several facets" blocks, so they read as a labelled
 * section rather than a list of choices.
 */

function BlockSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
      {children}
    </div>
  )
}

/**
 * Agent-supplied image.
 *
 * Plain <img> for the same reason as the cards: the URL arrives at runtime and is
 * not in the image optimiser's allowlist. Scheme-checked because the URL is
 * untrusted; a rejected source renders nothing rather than a broken request.
 */
function BlockImage({
  src,
  alt,
  className,
}: {
  src: string
  alt: string
  className?: string
}) {
  const [hasError, setHasError] = React.useState(false)
  const [isLoaded, setIsLoaded] = React.useState(false)
  const safe = normalizeImageUrl(src)
  if (!safe) return null

  if (hasError) {
    return (
      <div className={cn('flex flex-col items-center justify-center bg-[var(--surface-sunken)] p-4 text-center', className)}>
        <Compass className="size-8 text-[var(--accent)] mb-1" />
        <span className="text-xs text-[var(--text-tertiary)]">{alt}</span>
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={safe}
      alt={alt}
      loading="lazy"
      decoding="async"
      onLoad={() => setIsLoaded(true)}
      onError={() => setHasError(true)}
      className={cn(
        'size-full object-cover transition-opacity duration-300',
        isLoaded ? 'opacity-100' : 'opacity-0',
        className,
      )}
    />
  )
}

/* ------------------------------------------------------------------ details */

type TripDetail = Extract<ContentPayload, { type: 'trip_detail' }>['data']
type HotelDetail = Extract<ContentPayload, { type: 'hotel_detail' }>['data']

export function TripDetailBlock({
  data,
  onAsk,
}: {
  data: TripDetail
  onAsk: (text: string) => void
}) {
  const t = useTranslations('content')
  const tCatalog = useTranslations('catalog')
  const tTrips = useTranslations('trips')

  /*
   * Spec §6 lets the user ask "can I see photos?" and §7 "where is this place?".
   * A trip detail already carries both, so surface them here instead of requiring
   * a second and third round-trip to the agent.
   */
  const galleryImages = React.useMemo(() => {
    const urls = data.images ?? []
    // The hero is already shown above; repeating it as thumbnail one is noise.
    const rest = data.imageUrl ? urls.filter((url) => url !== data.imageUrl) : urls
    return rest.map((url) => ({ url }))
  }, [data.images, data.imageUrl])

  const mapsUrl = googleMapsPlaceUrl({ lat: data.lat, lng: data.lng }, data.name)
  const directionsUrl = googleMapsDirectionsUrl(
    { lat: data.lat, lng: data.lng },
    { destinationName: data.name },
  )

  return (
    <Panel>
      <div className="flex flex-col gap-3">
        {data.imageUrl ? (
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[var(--radius-md)] bg-[var(--surface-sunken)]">
            <BlockImage src={data.imageUrl} alt={data.name} />
          </div>
        ) : null}

        <div className="flex flex-col gap-1">
          <h4 className="text-base font-semibold text-[var(--text-primary)]">{data.name}</h4>
          <p className="flex flex-wrap items-baseline gap-1.5">
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              <Price amountUsd={data.priceUsd} />
            </span>
            <span className="text-xs text-[var(--text-tertiary)]">{t('perPerson')}</span>
            {data.durationDays !== undefined ? (
              <span className="text-xs text-[var(--text-tertiary)]">· {data.durationDays}d</span>
            ) : null}
            {data.rating !== undefined ? (
              <span className="text-xs text-[var(--text-tertiary)]">
                · ★ {data.rating.toFixed(1)}
              </span>
            ) : null}
          </p>
        </div>

        {data.description ? (
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            {data.description}
          </p>
        ) : null}

        {galleryImages.length > 0 ? (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-[var(--text-secondary)]">
              {t('gallery')}
            </p>
            <GalleryRail images={galleryImages} title={`${data.name} — ${t('gallery')}`} />
          </div>
        ) : null}

        {data.itinerary && data.itinerary.length > 0 ? (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-[var(--text-secondary)]">
              {t('itinerary')}
            </p>
            <ol className="flex flex-col gap-1.5">
              {data.itinerary.map((day) => (
                <li key={day.day} className="flex gap-2 text-sm">
                  <span className="shrink-0 font-medium text-[var(--accent-subtle-text)]">
                    {tCatalog('detail.day', { number: day.day })}
                  </span>
                  <span className="text-[var(--text-secondary)]">
                    {day.title}
                    {day.description ? ` — ${day.description}` : ''}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {data.included && data.included.length > 0 ? (
          <IncludedList label={tTrips('detail.included')} items={data.included} included />
        ) : null}

        {data.excluded && data.excluded.length > 0 ? (
          <IncludedList label={tTrips('detail.excluded')} items={data.excluded} included={false} />
        ) : null}

        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" onClick={() => onAsk(`Book "${data.name}"`)}>
            {t('bookNow')}
          </Button>
          {mapsUrl ? <GoogleMapsLink href={mapsUrl} /> : null}
          {directionsUrl ? <DirectionsLink href={directionsUrl} /> : null}
          <Link
            href={`/trips/${data.id}`}
            className="inline-flex min-h-9 items-center rounded-[var(--radius-md)] px-2.5 text-xs font-medium text-[var(--accent-subtle-text)] underline-offset-2 hover:underline pointer-coarse:min-h-11"
          >
            {t('viewDetails')}
          </Link>
        </div>
      </div>
    </Panel>
  )
}

/** Inclusions and exclusions, distinguished by an icon rather than colour alone. */
function IncludedList({
  label,
  items,
  included,
}: {
  label: string
  items: string[]
  included: boolean
}) {
  return (
    <ul className="flex flex-col gap-1" aria-label={label}>
      {items.map((item) => (
        <li key={item} className="flex items-start gap-1.5 text-sm text-[var(--text-secondary)]">
          <span
            aria-hidden="true"
            className={cn(
              'mt-0.5 shrink-0 text-xs',
              included ? 'text-[var(--tone-success-text)]' : 'text-[var(--text-tertiary)]',
            )}
          >
            {included ? '✓' : '✕'}
          </span>
          {item}
        </li>
      ))}
    </ul>
  )
}

export function HotelDetailBlock({
  data,
  onAsk,
}: {
  data: HotelDetail
  onAsk: (text: string) => void
}) {
  const t = useTranslations('content')
  const tCatalog = useTranslations('catalog')

  const galleryImages = React.useMemo(() => {
    const urls = data.images ?? []
    const rest = data.imageUrl ? urls.filter((url) => url !== data.imageUrl) : urls
    return rest.map((url) => ({ url }))
  }, [data.images, data.imageUrl])

  // "Where is the hotel?" (§7) — answered with a real map handoff, not coordinates.
  const mapsUrl = googleMapsPlaceUrl({ lat: data.lat, lng: data.lng }, data.name)
  const directionsUrl = googleMapsDirectionsUrl(
    { lat: data.lat, lng: data.lng },
    { destinationName: data.name },
  )

  return (
    <Panel>
      <div className="flex flex-col gap-3">
        {data.imageUrl ? (
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[var(--radius-md)] bg-[var(--surface-sunken)]">
            <BlockImage src={data.imageUrl} alt={data.name} />
          </div>
        ) : null}

        <div className="flex flex-col gap-1">
          <h4 className="text-base font-semibold text-[var(--text-primary)]">{data.name}</h4>
          {data.address ? (
            <p className="text-xs text-[var(--text-tertiary)]">{data.address}</p>
          ) : null}
          <p className="flex flex-wrap items-baseline gap-1.5">
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              <Price amountUsd={data.priceUsd} />
            </span>
            <span className="text-xs text-[var(--text-tertiary)]">{t('perNight')}</span>
            {data.rating !== undefined ? (
              <span className="text-xs text-[var(--text-tertiary)]">
                · ★ {data.rating.toFixed(1)}
              </span>
            ) : null}
          </p>
        </div>

        {data.description ? (
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            {data.description}
          </p>
        ) : null}

        {galleryImages.length > 0 ? (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-[var(--text-secondary)]">
              {t('gallery')}
            </p>
            <GalleryRail images={galleryImages} title={`${data.name} — ${t('gallery')}`} />
          </div>
        ) : null}

        {data.amenities && data.amenities.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5" aria-label={tCatalog('detail.amenities')}>
            {data.amenities.map((amenity) => (
              <li key={amenity}>
                <Badge>{amenity}</Badge>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onAsk(`Is "${data.name}" available?`)}
          >
            {t('checkAvailability')}
          </Button>
          {mapsUrl ? <GoogleMapsLink href={mapsUrl} /> : null}
          {directionsUrl ? <DirectionsLink href={directionsUrl} /> : null}
          <Link
            href={`/hotels/${data.id}`}
            className="inline-flex min-h-9 items-center rounded-[var(--radius-md)] px-2.5 text-xs font-medium text-[var(--accent-subtle-text)] underline-offset-2 hover:underline pointer-coarse:min-h-11"
          >
            {t('viewDetails')}
          </Link>
        </div>
      </div>
    </Panel>
  )
}

/* ---------------------------------------------------------------- itinerary */

type ItineraryData = Extract<ContentPayload, { type: 'itinerary' }>['data']

export function ItineraryBlock({ data }: { data: ItineraryData }) {
  const t = useTranslations('content')
  const tCatalog = useTranslations('catalog')

  if (data.days.length === 0) return null

  return (
    <BlockSection title={t('itinerary')}>
      {/* An ordered list, because the sequence of days is the meaning. */}
      <ol className="flex flex-col gap-2">
        {data.days.map((day) => (
          <li
            key={day.day}
            className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3"
          >
            <p className="text-sm font-medium text-[var(--text-primary)]">
              <span className="text-[var(--accent-subtle-text)]">
                {tCatalog('detail.day', { number: day.day })}
              </span>
              {' — '}
              {day.title}
            </p>
            {day.activities.length > 0 ? (
              <ul className="mt-1.5 flex flex-col gap-1">
                {day.activities.map((activity) => (
                  <li
                    key={activity}
                    className="flex items-start gap-1.5 text-sm text-[var(--text-secondary)]"
                  >
                    <span aria-hidden="true" className="mt-1 text-[var(--text-tertiary)]">
                      •
                    </span>
                    {activity}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>
    </BlockSection>
  )
}

/* ------------------------------------------------------------------ gallery */

type GalleryData = Extract<ContentPayload, { type: 'image_gallery' }>['data']

export function ImageGalleryBlock({ data }: { data: GalleryData }) {
  const t = useTranslations('content')

  if (data.images.length === 0) return null

  /*
   * The rail is only the index — tapping a thumbnail opens a full-size, keyboard
   * navigable viewer. Judging a room or a temple from a 160px crop is not really
   * "seeing photos", which is what the user asked for.
   */
  return (
    <BlockSection title={t('gallery')}>
      <GalleryRail images={data.images} title={t('gallery')} />
    </BlockSection>
  )
}

/* ------------------------------------------------------------------ weather */

type WeatherData = Extract<ContentPayload, { type: 'weather' }>['data']

export function WeatherBlock({ data }: { data: WeatherData }) {
  const t = useTranslations('weather')
  const tContent = useTranslations('content')

  if (data.forecast.length === 0) return null

  return (
    <BlockSection title={data.forecast.length >= 5 ? t('fiveDay') : tContent('weather')}>
      <ul
        aria-label={tContent('weather')}
        className="flex snap-x gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-5 sm:overflow-visible sm:pb-0"
      >
        {data.forecast.map((day) => (
          <li
            key={day.date}
            className="flex w-24 shrink-0 snap-start flex-col items-center gap-0.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface)] p-2 text-center sm:w-auto"
          >
            <p className="text-xs font-medium text-[var(--text-secondary)]">
              {formatDayLabel(day.date)}
            </p>
            <p className="text-xs text-[var(--text-tertiary)]">{day.condition}</p>
            {/* High and low are labelled, not just ordered, so the pair is unambiguous. */}
            <p className="text-sm text-[var(--text-primary)]">
              <span className="font-semibold">{Math.round(day.high)}°</span>
              <span className="sr-only"> high, </span>
              <span className="text-[var(--text-tertiary)]"> {Math.round(day.low)}°</span>
              <span className="sr-only"> low</span>
            </p>
          </li>
        ))}
      </ul>
    </BlockSection>
  )
}

/** Short weekday label, falling back to the raw value if it is not a date. */
function formatDayLabel(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { weekday: 'short' })
}

/* ------------------------------------------------------------------- budget */

type BudgetData = Extract<ContentPayload, { type: 'budget_estimate' }>['data']

export function BudgetEstimateBlock({ data }: { data: BudgetData }) {
  const t = useTranslations('budget')
  const tContent = useTranslations('content')

  const entries = Object.entries(data.breakdown)

  return (
    <BlockSection title={t('title')}>
      <Panel>
        {entries.length > 0 ? (
          /*
           * A definition list: each row is a label/amount pair, which is exactly
           * what dt/dd describe, and screen readers announce them as pairs.
           */
          <dl className="flex flex-col gap-1.5">
            {entries.map(([key, amount]) => (
              <div key={key} className="flex items-baseline justify-between gap-2">
                <dt className="text-sm text-[var(--text-secondary)]">{budgetLabel(key, t)}</dt>
                <dd className="text-sm text-[var(--text-primary)]">
                  <Price amountUsd={amount} />
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        <div className="mt-2 flex items-baseline justify-between gap-2 border-t border-[var(--border-subtle)] pt-2">
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            {tContent('budget')}
          </p>
          <p className="text-base font-semibold text-[var(--text-primary)]">
            <Price amountUsd={data.totalUsd} />
          </p>
        </div>
      </Panel>
    </BlockSection>
  )
}

/**
 * Budget categories come from the agent as snake_case keys. The four known ones
 * have translations; anything else is humanised rather than shown raw.
 */
function budgetLabel(key: string, t: ReturnType<typeof useTranslations<'budget'>>): string {
  if (t.has(key as never)) return t(key as never)
  const spaced = key.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/* ------------------------------------------------------------- text summary */

type TextSummaryData = Extract<ContentPayload, { type: 'text_summary' }>['data']

export function TextSummaryBlock({ data }: { data: TextSummaryData }) {
  if (!data.text.trim()) return null

  return (
    <Panel>
      <p className="text-sm leading-relaxed whitespace-pre-wrap text-[var(--text-secondary)]">
        {data.text}
      </p>
    </Panel>
  )
}
