import { getTranslations } from 'next-intl/server'

import { Price } from '@/components/shared/price'
import { Rating } from '@/components/shared/rating'
import { CardMedia } from '@/components/shared/card-media'
import { Badge, Card, CardContent } from '@/components/ui'
import { cn } from '@/lib/cn'
import { localeTags, type Locale } from '@/lib/i18n/config'
import { Link } from '@/lib/i18n/navigation'
import type { GuideSummary, HotelSummary, TripSummary, VehicleSummary } from '@/schemas/domain'

/**
 * Catalogue cards shared by the discovery rails and the browse pages.
 *
 * Each entity has its own card because the field names genuinely differ — trips
 * expose `coverImageUrl` while hotels and vehicles expose `coverImage`, and the
 * guide list carries no name at all. Papering over that with one generic card
 * would hide the difference and break silently when the API changes.
 */

function CardShell({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <Card interactive as="article" className={cn('h-full overflow-hidden', className)}>
      {/* The whole card is the link target, so the tap area is the full card. */}
      <Link href={href} className="block h-full focus-visible:outline-none">
        {children}
      </Link>
    </Card>
  )
}

export async function TripCard({
  trip,
  locale,
  priority = false,
  className,
}: {
  trip: TripSummary
  locale: Locale
  priority?: boolean
  className?: string
}) {
  const t = await getTranslations('trips')

  return (
    <CardShell href={`/trips/${trip.id}`} className={className}>
      <CardMedia src={trip.coverImageUrl} priority={priority}>
        {trip.category ? (
          <span className="absolute top-2 left-2">
            <Badge tone="neutral" className="bg-[var(--surface)]/90 backdrop-blur">
              {trip.category}
            </Badge>
          </span>
        ) : null}
      </CardMedia>

      <CardContent className="space-y-2 pt-4">
        <h3 className="line-clamp-2 text-base leading-tight font-semibold tracking-tight">
          {trip.name}
        </h3>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--text-secondary)]">
          <span>
            {trip.durationDays} {t('card.days')}
          </span>
          <Rating average={trip.ratingAverage} count={trip.ratingCount} locale={localeTags[locale]} />
        </div>
        <p className="text-sm">
          <Price
            amountUsd={trip.priceUsd}
            className="font-semibold text-[var(--text-primary)]"
            suffix={t('card.perPerson')}
          />
        </p>
      </CardContent>
    </CardShell>
  )
}

export async function HotelCard({
  hotel,
  className,
}: {
  hotel: HotelSummary
  className?: string
}) {
  const t = await getTranslations('hotels')

  return (
    <CardShell href={`/hotels/${hotel.id}`} className={className}>
      {/* Hotels expose `coverImage`, not `coverImageUrl`. */}
      <CardMedia src={hotel.coverImage} />

      <CardContent className="space-y-2 pt-4">
        <h3 className="line-clamp-2 text-base leading-tight font-semibold tracking-tight">
          {hotel.name}
        </h3>
        {hotel.address ? (
          <p className="line-clamp-1 text-sm text-[var(--text-secondary)]">{hotel.address}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--text-secondary)]">
          {typeof hotel.starRating === 'number' ? (
            <span aria-label={`${hotel.starRating} star`}>{'★'.repeat(hotel.starRating)}</span>
          ) : null}
        </div>
        {typeof hotel.priceFromUsd === 'number' ? (
          <p className="text-sm">
            <span className="text-[var(--text-tertiary)]">{t('card.from')} </span>
            <Price
              amountUsd={hotel.priceFromUsd}
              className="font-semibold text-[var(--text-primary)]"
              suffix={t('card.perNight')}
            />
          </p>
        ) : null}
      </CardContent>
    </CardShell>
  )
}

export async function GuideCard({
  guide,
  className,
}: {
  guide: GuideSummary
  className?: string
}) {
  const t = await getTranslations('guides')

  /*
   * The guide list projection carries no `name`, so the heading falls back to the
   * province. Rendering an empty heading would break both the visual hierarchy
   * and the document outline.
   */
  const heading = guide.name ?? guide.province ?? t('card.verified')

  return (
    <CardShell href={`/guides/${guide.id}`} className={className}>
      <CardMedia src={guide.avatarUrl} ratio="1/1" />

      <CardContent className="space-y-2 pt-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-base leading-tight font-semibold tracking-tight">
            {heading}
          </h3>
          {guide.isVerified ? <Badge tone="success">{t('card.verified')}</Badge> : null}
        </div>

        {guide.languages && guide.languages.length > 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">
            {guide.languages.map((code) => code.toUpperCase()).join(' · ')}
          </p>
        ) : null}

        {guide.specialities && guide.specialities.length > 0 ? (
          <p className="line-clamp-1 text-sm text-[var(--text-tertiary)]">
            {guide.specialities.join(', ')}
          </p>
        ) : null}

        <p className="text-sm">
          <Price
            amountUsd={guide.pricePerDayUsd}
            className="font-semibold text-[var(--text-primary)]"
            suffix={t('card.perDay')}
          />
        </p>
      </CardContent>
    </CardShell>
  )
}

export async function VehicleCard({
  vehicle,
  className,
}: {
  vehicle: VehicleSummary
  className?: string
}) {
  const t = await getTranslations('transportation')

  return (
    <CardShell href={`/transport/${vehicle.id}`} className={className}>
      <CardMedia src={vehicle.coverImage} ratio="16/9" />

      <CardContent className="space-y-2 pt-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-base leading-tight font-semibold tracking-tight">
            {vehicle.name}
          </h3>
          <Badge tone="neutral">{vehicle.vehicleType.replace(/_/g, ' ')}</Badge>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          {vehicle.capacity} {t('card.seats')}
          {vehicle.province ? ` · ${vehicle.province}` : ''}
        </p>
        <p className="text-sm">
          <Price amountUsd={vehicle.priceUsd} className="font-semibold text-[var(--text-primary)]" />
        </p>
      </CardContent>
    </CardShell>
  )
}
