'use client'

import { ChevronDown, Clock } from 'lucide-react'
import { useTranslations } from '@/lib/i18n'
import type { ItineraryDay } from '@/types/catalog'

export function TripItinerary({ days }: { days: ItineraryDay[] }) {
  const t = useTranslations('trips')
  if (!days || days.length === 0) return null

  return (
    <div className="divide-y divide-border rounded-lg border border-border">
      {days.map((day) => (
        <details key={day.dayNumber} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 font-medium text-foreground [&::-webkit-details-marker]:hidden">
            <span className="min-w-0">
              {t('detail.day', { n: day.dayNumber })} · {day.title}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {day.durationHours != null && day.durationHours > 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  {t('detail.duration', { n: day.durationHours })}
                </span>
              ) : null}
              <ChevronDown
                className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180"
                aria-hidden
              />
            </span>
          </summary>
          <div className="px-4 pb-4 text-sm text-muted-foreground">{day.description}</div>
        </details>
      ))}
    </div>
  )
}
