'use client'

import { useTranslations } from 'next-intl'
import * as React from 'react'

import { Price } from '@/components/shared/price'
import { Badge, Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import { Link } from '@/lib/i18n/navigation'
import type {
  PayloadGuide,
  PayloadHotel,
  PayloadTransport,
  PayloadTrip,
} from '@/schemas/vibe-payloads'

/**
 * Card blocks for chat results.
 *
 * Two affordances per card, and both do real work:
 *  - a link to the catalogue detail page (the agent's ids come from the same
 *    database, so /trips/<id> resolves), which survives reload and opens in a tab;
 *  - an "ask about this" button that sends a follow-up message, keeping the
 *    conversation as the primary interface.
 *
 * Payload `actions` are deliberately NOT used: the agent emits an empty array for
 * every block, so rendering buttons from it would produce nothing.
 */

export interface CardBlockProps {
  /** Sends a follow-up message on the user's behalf. */
  onAsk: (text: string) => void
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

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <li className="w-56 shrink-0 snap-start md:w-auto">
      <div className="flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface)]">
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
 */
function CardImage({ src, alt }: { src?: string; alt: string }) {
  if (!src) return null

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--surface-sunken)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="size-full object-cover"
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
}: {
  href: string
  askLabel: string
  onAsk: () => void
  detailLabel: string
}) {
  return (
    <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
      <Button variant="secondary" size="sm" onClick={onAsk}>
        {askLabel}
      </Button>
      <Link
        href={href}
        className="inline-flex min-h-9 items-center rounded-[var(--radius-md)] px-2.5 text-xs font-medium text-[var(--accent-subtle-text)] underline-offset-2 hover:underline pointer-coarse:min-h-11"
      >
        {detailLabel}
      </Link>
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
}: CardBlockProps & { trips: PayloadTrip[]; title?: string }) {
  const t = useTranslations('content')

  if (trips.length === 0) return null

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] uppercase">
        {title ?? t('trips')}
      </h3>
      <CardList label={title ?? t('trips')}>
        {trips.map((trip) => (
          <CardShell key={trip.id}>
            <CardImage src={trip.imageUrl} alt={trip.name} />
            <CardBody>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{trip.name}</p>

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
              />
            </CardBody>
          </CardShell>
        ))}
      </CardList>
    </section>
  )
}

/* ------------------------------------------------------------------ hotels */

export function HotelCardsBlock({ hotels, onAsk }: CardBlockProps & { hotels: PayloadHotel[] }) {
  const t = useTranslations('content')

  if (hotels.length === 0) return null

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] uppercase">
        {t('hotels')}
      </h3>
      <CardList label={t('hotels')}>
        {hotels.map((hotel) => (
          <CardShell key={hotel.id}>
            <CardImage src={hotel.imageUrl} alt={hotel.name} />
            <CardBody>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{hotel.name}</p>

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
              />
            </CardBody>
          </CardShell>
        ))}
      </CardList>
    </section>
  )
}

/* ------------------------------------------------------------------ guides */

export function GuideCardsBlock({ guides, onAsk }: CardBlockProps & { guides: PayloadGuide[] }) {
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
        {guides.map((guide) => (
          <CardShell key={guide.id}>
            <CardImage src={guide.avatarUrl} alt={guide.name} />
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

              <CardActions
                href={`/guides/${guide.id}`}
                detailLabel={t('viewDetails')}
                askLabel={t('checkAvailability')}
                onAsk={() => onAsk(`Is the guide "${guide.name}" available?`)}
              />
            </CardBody>
          </CardShell>
        ))}
      </CardList>
    </section>
  )
}

/* --------------------------------------------------------------- transport */

export function TransportOptionsBlock({
  options,
  onAsk,
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
        {options.map((option) => (
          <li
            key={option.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3"
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
                variant="secondary"
                size="sm"
                onClick={() => onAsk(`Book the ${option.operator} option`)}
              >
                {t('bookNow')}
              </Button>
            </div>
          </li>
        ))}
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
