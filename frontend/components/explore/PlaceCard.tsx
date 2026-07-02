'use client'

import { MapPin } from 'lucide-react'
import { EntityCard } from '@/components/shared/EntityCard'
import { useTranslations, useLanguageStore } from '@/lib/i18n'
import { useCurrency } from '@/hooks/use-currency'
import { formatCurrency } from '@/lib/format'
import { isFreePlace, type PlaceCategoryFilter } from '@/types/explore'
import type { PlaceSummary } from '@/types/domain'

interface PlaceCardProps {
  place: PlaceSummary
  /**
   * Href for the card. The Places tab passes a `?place=<id>` link so the detail
   * modal (task 8.5) can open from the URL; defaults to `/places/<id>` so the
   * card is still usable in isolation (e.g. tests, future standalone pages).
   */
  href?: string
}

/**
 * Result card for a place on the Explore → Places tab. Shows the cover image,
 * localized name, category badge, and entry fee (or a "Free" label) via the
 * shared {@link EntityCard}.
 *
 * No favorite control is rendered: the client-side wishlist
 * ({@link FavoriteType}) does not include places, and server-side place
 * favorites are owned by the Favorites work (Requirement 22 / task 21).
 *
 * The detail modal is owned by task 8.5; this card only links (default
 * `?place=<id>`) and does not render the modal itself.
 */
export function PlaceCard({ place, href }: PlaceCardProps) {
  const t = useTranslations('explore.places')
  const locale = useLanguageStore((s) => s.locale)
  const currency = useCurrency()

  const free = isFreePlace(place)
  const priceLabel = free
    ? t('free')
    : formatCurrency(place.entryFeeUsd as number, locale, currency)

  return (
    <EntityCard
      href={href ?? `/places/${place.id}`}
      title={place.name}
      imageUrl={place.coverImage}
      fallbackIcon={MapPin}
      badge={
        place.category
          ? { label: t(`categories.${place.category}`, undefined, 'categories.unknown') }
          : undefined
      }
      priceLabel={priceLabel}
      priceSuffix={free ? undefined : t('entryFee')}
    />
  )
}

export type { PlaceCardProps }
export type { PlaceCategoryFilter }
