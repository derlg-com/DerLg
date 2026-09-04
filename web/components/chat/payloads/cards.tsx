'use client'

import { Compass, Landmark, MapPin, User } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'

import { Price } from '@/components/shared/price'
import { Badge, Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import { Link } from '@/lib/i18n/navigation'
import { normalizeImageUrl, safeImageSrc } from '@/lib/url-safety'
import type {
  PayloadGuide,
  PayloadHotel,
  PayloadTransport,
  PayloadTrip,
} from '@/schemas/vibe-payloads'

/**
 * Card blocks for chat results.
 *
 * Affordances per card:
 *  - a primary "Book Now" action that triggers booking hold directly;
 *  - a "View on Map" action to immediately locate and spotlight the pin;
 *  - a link to the catalogue detail page;
 *  - an "ask about this" button that sends a conversational follow-up.
 */

export interface CardBlockProps {
  /** Sends a follow-up message on the user's behalf. */
  onAsk: (text: string) => void
  /** Currently selected/focused product ID (e.g. from pin click). */
  selectedProductId?: string | null
  /** Callback to select or focus a product. */
  onSelectProduct?: (id: string | null) => void
}

/** Horizontal rail below md, grid above. One DOM instance, CSS switches layout. */
function CardList({
  label,
  children,
  columns = 2,
}: {
  label: string
  children: React.ReactNode
  columns?: 2 | 3
}) {
  return (
    <ul
      aria-label={label}
      className={cn(
        'flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1',
        'md:grid md:overflow-visible md:pb-0',
        columns === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3',
      )}
    >
      {children}
    </ul>
  )
}

function CardShell({
  children,
  isSelected,
  onClick,
}: {
  children: React.ReactNode
  isSelected?: boolean
  onClick?: () => void
}) {
  return (
    <li className="w-56 shrink-0 snap-start md:w-auto">
      <div
        onClick={onClick}
        className={cn(
          'flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] border bg-[var(--surface)] transition-all duration-200 cursor-pointer',
          isSelected
            ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/40 shadow-md -translate-y-0.5'
            : 'border-[var(--border-subtle)] hover:border-[var(--border-default)] hover:shadow-xs',
        )}
      >
        {children}
      </div>
    </li>
  )
}

/**
 * Card image.
 *
 * A plain <img> rather than next/image: these URLs come from the AGENT at runtime,
 * so they are not known to the image optimiser's allowlist and would 400. Width and
 * height are fixed by the aspect box, so this does not cost layout shift.
 *
 * The source is scheme-checked first. An `<img>` cannot execute `javascript:` or
 * `data:text/html`, so this is not an XSS fix — it stops a nonsense request and
 * keeps the "agent URLs are untrusted" rule uniform across every render site.
 */
function CardImage({
  src,
  alt,
  kind = 'trip',
}: {
  src?: string
  alt: string
  kind?: 'trip' | 'hotel' | 'guide' | 'transport'
}) {
  const [hasError, setHasError] = React.useState(false)
  const [isLoaded, setIsLoaded] = React.useState(false)
  const safe = normalizeImageUrl(src)
  if (!safe) return null

  const fallbackIcon = {
    trip: <Compass className="size-8 text-[var(--accent)]" />,
    hotel: <Landmark className="size-8 text-[var(--accent)]" />,
    guide: <User className="size-8 text-[var(--accent)]" />,
    transport: <MapPin className="size-8 text-[var(--accent)]" />,
  }[kind]

  if (hasError) {
    return (
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-[var(--surface-sunken)] to-[var(--surface)] flex flex-col items-center justify-center p-3 text-center border-b border-[var(--border-subtle)]">
        <div className="flex size-12 items-center justify-center rounded-full bg-[var(--surface)] shadow-xs">
          {fallbackIcon}
        </div>
        <span className="mt-2 text-xs font-medium text-[var(--text-secondary)] line-clamp-1 max-w-[85%]">
          {alt}
        </span>
      </div>
    )
  }

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--surface-sunken)]">
      {!isLoaded ? (
        <div className="absolute inset-0 animate-pulse bg-[var(--surface-sunken)]" />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
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
        )}
      />
    </div>
  )
}

function CardBody({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col gap-1.5 p-3">{children}</div>
}

function CardActions({
  href,
  askLabel,
  onAsk,
  detailLabel,
  bookLabel,
  onBook,
  onViewMap,
  mapLabel = 'Map',
}: {
  href: string
  askLabel: string
  onAsk: () => void
  detailLabel: string
  bookLabel?: string
  onBook?: () => void
  onViewMap?: () => void
  mapLabel?: string
}) {
  return (
    <div className="mt-auto flex flex-col gap-1.5 pt-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {onBook && bookLabel ? (
          <Button
            variant="primary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onBook()
            }}
            className="font-medium text-xs"
          >
            {bookLabel}
          </Button>
        ) : null}
        {onViewMap ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onViewMap()
            }}
            className="gap-1 text-xs"
          >
            <MapPin aria-hidden="true" className="size-3.5 text-[var(--accent)]" />
            {mapLabel}
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            onAsk()
          }}
          className="text-xs"
        >
          {askLabel}
        </Button>
        <Link
          href={href}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex min-h-8 items-center rounded-[var(--radius-md)] px-2 text-xs font-medium text-[var(--accent-subtle-text)] underline-offset-2 hover:underline pointer-coarse:min-h-10"
        >
          {detailLabel}
        </Link>
      </div>
    </div>
  )
}

function Meta({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-[var(--text-tertiary)]">{children}</p>
}

/* ------------------------------------------------------------------- trips */

export function TripCardsBlock({
  trips,
  onAsk,
  title,
  selectedProductId,
  onSelectProduct,
}: CardBlockProps & { trips: PayloadTrip[]; title?: string }) {
  const t = useTranslations('content')

  if (trips.length === 0) return null

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] uppercase">
        {title ?? t('trips')}
      </h3>
      <CardList label={title ?? t('trips')}>
        {trips.map((trip) => {
          const isSelected = selectedProductId === trip.id
          const hasLocation = trip.lat !== undefined && trip.lng !== undefined

          return (
            <CardShell
              key={trip.id}
              isSelected={isSelected}
              onClick={() => onSelectProduct?.(trip.id)}
            >
              <CardImage src={trip.imageUrl} alt={trip.name} kind="trip" />
              <CardBody>
                <div className="flex items-start justify-between gap-1">
                  <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug">
                    {trip.name}
                  </p>
                  {trip.rating ? (
                    <Badge tone="accent" className="shrink-0 px-1.5 py-0 text-[10px]">
                      ★ {trip.rating.toFixed(1)}
                    </Badge>
                  ) : null}
                </div>

                {trip.blurb ?? trip.description ? (
                  <p className="line-clamp-2 text-xs text-[var(--text-secondary)]">
                    {trip.blurb ?? trip.description}
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    <Price amountUsd={trip.priceUsd} />
                  </span>
                  <span className="text-xs text-[var(--text-tertiary)]">{t('perPerson')}</span>
                </div>

                {trip.durationDays !== undefined || trip.province ? (
                  <Meta>
                    {[
                      trip.durationDays !== undefined ? `${trip.durationDays}d` : null,
                      trip.province,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Meta>
                ) : null}

                <CardActions
                  href={`/trips/${trip.id}`}
                  detailLabel={t('viewDetails')}
                  askLabel={t('findMoreLikeThis')}
                  onAsk={() => onAsk(`Tell me more about "${trip.name}"`)}
                  bookLabel={t('bookNow')}
                  onBook={() => onAsk(`Book the trip "${trip.name}"`)}
                  onViewMap={hasLocation ? () => onSelectProduct?.(trip.id) : undefined}
                />
              </CardBody>
            </CardShell>
          )
        })}
      </CardList>
    </section>
  )
}

/* ------------------------------------------------------------------ hotels */

export function HotelCardsBlock({
  hotels,
  onAsk,
  selectedProductId,
  onSelectProduct,
}: CardBlockProps & { hotels: PayloadHotel[] }) {
  const t = useTranslations('content')

  if (hotels.length === 0) return null

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] uppercase">
        {t('hotels')}
      </h3>
      <CardList label={t('hotels')}>
        {hotels.map((hotel) => {
          const isSelected = selectedProductId === hotel.id
          const hasLocation = hotel.lat !== undefined && hotel.lng !== undefined

          return (
            <CardShell
              key={hotel.id}
              isSelected={isSelected}
              onClick={() => onSelectProduct?.(hotel.id)}
            >
              <CardImage src={hotel.imageUrl} alt={hotel.name} kind="hotel" />
              <CardBody>
                <div className="flex items-start justify-between gap-1">
                  <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug">
                    {hotel.name}
                  </p>
                  {hotel.rating ? (
                    <Badge tone="accent" className="shrink-0 px-1.5 py-0 text-[10px]">
                      ★ {hotel.rating.toFixed(1)}
                    </Badge>
                  ) : null}
                </div>

                {hotel.blurb ?? hotel.address ? (
                  <p className="line-clamp-2 text-xs text-[var(--text-secondary)]">
                    {hotel.blurb ?? hotel.address}
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    <Price amountUsd={hotel.priceUsd} />
                  </span>
                  <span className="text-xs text-[var(--text-tertiary)]">{t('perNight')}</span>
                </div>

                {hotel.amenities && hotel.amenities.length > 0 ? (
                  <Meta>{hotel.amenities.slice(0, 3).join(' · ')}</Meta>
                ) : null}

                <CardActions
                  href={`/hotels/${hotel.id}`}
                  detailLabel={t('viewDetails')}
                  askLabel={t('checkAvailability')}
                  onAsk={() => onAsk(`Is "${hotel.name}" available?`)}
                  bookLabel={t('bookNow')}
                  onBook={() => onAsk(`Book hotel "${hotel.name}"`)}
                  onViewMap={hasLocation ? () => onSelectProduct?.(hotel.id) : undefined}
                />
              </CardBody>
            </CardShell>
          )
        })}
      </CardList>
    </section>
  )
}

/* ------------------------------------------------------------------ guides */

export function GuideCardsBlock({
  guides,
  onAsk,
  selectedProductId,
  onSelectProduct,
}: CardBlockProps & { guides: PayloadGuide[] }) {
  const t = useTranslations('content')
  const tGuides = useTranslations('guides')
  const tNav = useTranslations('shell')

  if (guides.length === 0) return null

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] uppercase">
        {tNav('nav.guides')}
      </h3>
      <CardList label={tNav('nav.guides')}>
        {guides.map((guide) => {
          const isSelected = selectedProductId === guide.id

          return (
            <CardShell
              key={guide.id}
              isSelected={isSelected}
              onClick={() => onSelectProduct?.(guide.id)}
            >
              <CardImage src={guide.avatarUrl} alt={guide.name} kind="guide" />
              <CardBody>
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{guide.name}</p>
                  {guide.isVerified ? (
                    <Badge tone="success">{tGuides('card.verified')}</Badge>
                  ) : null}
                </div>

                {guide.bio ? (
                  <p className="line-clamp-2 text-xs text-[var(--text-secondary)]">{guide.bio}</p>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    <Price amountUsd={guide.pricePerDayUsd} />
                  </span>
                  <span className="text-xs text-[var(--text-tertiary)]">
                    {tGuides('card.perDay')}
                  </span>
                </div>

                {guide.languages && guide.languages.length > 0 ? (
                  <Meta>{guide.languages.join(' · ')}</Meta>
                ) : null}

                {guide.specialities && guide.specialities.length > 0 ? (
                  <Meta>{guide.specialities.join(' · ')}</Meta>
                ) : null}

                <CardActions
                  href={`/guides/${guide.id}`}
                  detailLabel={t('viewDetails')}
                  askLabel={t('checkAvailability')}
                  onAsk={() => onAsk(`Is the guide "${guide.name}" available?`)}
                  bookLabel={t('bookNow')}
                  onBook={() => onAsk(`Book tour guide "${guide.name}"`)}
                />
              </CardBody>
            </CardShell>
          )
        })}
      </CardList>
    </section>
  )
}

/* --------------------------------------------------------------- transport */

export function TransportOptionsBlock({
  options,
  onAsk,
  selectedProductId,
  onSelectProduct,
}: CardBlockProps & { options: PayloadTransport[] }) {
  const t = useTranslations('content')

  if (options.length === 0) return null

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] uppercase">
        {t('transport')}
      </h3>
      {/* A list rather than cards: these are compared on price and duration, which
          reads better in aligned rows than in a rail. */}
      <ul aria-label={t('transport')} className="flex flex-col gap-2">
        {options.map((option) => {
          const isSelected = selectedProductId === option.id

          return (
            <li
              key={option.id}
              onClick={() => onSelectProduct?.(option.id)}
              className={cn(
                'flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border bg-[var(--surface)] p-3 transition-all duration-200 cursor-pointer',
                isSelected
                  ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/40 shadow-md'
                  : 'border-[var(--border-subtle)] hover:border-[var(--border-default)]',
              )}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)]">{option.operator}</p>
                <Meta>
                  {[
                    formatMode(option.mode),
                    option.durationMinutes !== undefined
                      ? formatDuration(option.durationMinutes)
                      : null,
                    option.departureTime,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Meta>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  <Price amountUsd={option.priceUsd} />
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onAsk(`Book the ${option.operator} option`)
                  }}
                >
                  {t('bookNow')}
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** tuk_tuk -> Tuk tuk. The agent sends snake_case modes. */
function formatMode(mode: string): string {
  const spaced = mode.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}
