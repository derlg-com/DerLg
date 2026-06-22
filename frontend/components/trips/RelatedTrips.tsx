'use client'

import { useApiQuery } from '@/lib/use-api-query'
import { TripCard } from './TripCard'
import { useTranslations } from '@/lib/i18n'
import type { TripSummary } from '@/types/catalog'

export function RelatedTrips({ tripId }: { tripId: string }) {
  const t = useTranslations('trips')
  const { data } = useApiQuery<TripSummary[]>(`/v1/trips/${tripId}/related`)
  const related = data ?? []
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
