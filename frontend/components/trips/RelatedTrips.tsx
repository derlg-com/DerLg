'use client'

import { useApiQuery } from '@/lib/use-api-query'
import { TripCard } from './TripCard'
import { Skeleton } from '@/components/ui/skeleton'
import { useTranslations } from '@/lib/i18n'
import type { TripSummary } from '@/types/catalog'

/**
 * Recommended/similar trips shelf shown at the bottom of the trip detail page.
 *
 * Requirement 36.9 — "display similar or recommended trips at the bottom of
 * the page". Fetches `/v1/trips/{id}/related`, renders a horizontal shelf of
 * TripCards, and handles the loading / error / empty cases gracefully:
 * - loading: skeleton placeholders so the section doesn't pop in,
 * - error: the section is hidden (recommendations are supplementary — a failed
 *   fetch must never block the rest of the detail page),
 * - empty: the section is hidden (nothing to recommend).
 *
 * Defensively filters out the current trip so a backend that includes it in
 * the "related" payload never renders a self-referential card.
 */
export function RelatedTrips({ tripId }: { tripId: string }) {
  const t = useTranslations('trips')
  const { data, error, isLoading } = useApiQuery<TripSummary[]>(`/v1/trips/${tripId}/related`)

  if (isLoading) {
    return (
      <section className="space-y-3" aria-busy="true">
        <h2 className="text-lg font-semibold text-foreground">{t('detail.related')}</h2>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-56 shrink-0 rounded-2xl" />
          ))}
        </div>
      </section>
    )
  }

  // Recommendations are supplementary: never surface an error or an empty
  // shelf — just omit the section so the rest of the detail page is unaffected.
  if (error) return null

  const related = (data ?? []).filter((trip) => trip.id !== tripId)
  if (related.length === 0) return null

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{t('detail.related')}</h2>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {related.map((trip) => (
          <div key={trip.id} className="w-56 shrink-0">
            <TripCard trip={trip} />
          </div>
        ))}
      </div>
    </section>
  )
}
