'use client'

import { CalendarDays, MapPin } from 'lucide-react'
import { EntityCard } from '@/components/shared/EntityCard'
import { useLanguageStore } from '@/lib/i18n'
import { formatDateShort } from '@/lib/format'
import type { FestivalSummary } from '@/types/domain'

/**
 * Result card for an upcoming festival, used on the Home shelf and the Explore
 * Festivals tab. Shows the festival name, its date range, and province/location
 * via the shared {@link EntityCard}. Favoriting is offered on the festival
 * detail view (FavoriteType now includes `'festival'`), not on the card.
 */
export function FestivalCard({ festival }: { festival: FestivalSummary }) {
  const locale = useLanguageStore((s) => s.locale)

  const start = formatDateShort(festival.startDate, locale)
  const end = formatDateShort(festival.endDate, locale)
  const dateRange = start === end ? start : `${start} – ${end}`
  const place = festival.location ?? festival.province ?? undefined

  return (
    <EntityCard
      href={`/festivals/${festival.id}`}
      title={festival.name}
      imageUrl={festival.coverImage}
      imageAspect="4/3"
      fallbackIcon={CalendarDays}
      subtitle={
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {dateRange}
        </span>
      }
      meta={
        place ? (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {place}
          </span>
        ) : undefined
      }
    />
  )
}
