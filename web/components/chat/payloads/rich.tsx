'use client'

import { useTranslations } from 'next-intl'
import * as React from 'react'

import { Price } from '@/components/shared/price'
import { Badge, Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import { Link } from '@/lib/i18n/navigation'
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
 * not in the image optimiser's allowlist.
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
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={cn('size-full object-cover', className)}
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
          </p>
        </div>

        {data.description ? (
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            {data.description}
          </p>
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
          <Button variant="secondary" size="sm" onClick={() => onAsk(`Book "${data.name}"`)}>
            {t('bookNow')}
          </Button>
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
          </p>
        </div>

        {data.description ? (
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            {data.description}
          </p>
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

  return (
    <BlockSection title={t('gallery')}>
      <ul
        aria-label={t('gallery')}
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0"
      >
        {data.images.map((image, index) => (
          <li key={image.url} className="w-40 shrink-0 snap-start sm:w-auto">
            <figure className="flex flex-col gap-1">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-md)] bg-[var(--surface-sunken)]">
                {/*
                 * Falls back to a positional description rather than an empty alt:
                 * these are content images, so they are not decorative.
                 */}
                <BlockImage src={image.url} alt={image.caption ?? `${t('gallery')} ${index + 1}`} />
              </div>
              {image.caption ? (
                <figcaption className="text-xs text-[var(--text-tertiary)]">
                  {image.caption}
                </figcaption>
              ) : null}
            </figure>
          </li>
        ))}
      </ul>
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
