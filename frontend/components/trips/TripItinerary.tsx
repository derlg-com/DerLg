'use client'

import { ChevronDown } from 'lucide-react'
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
            <span>
              {t('detail.day', { n: day.dayNumber })} · {day.title}
            </span>
            <ChevronDown
              className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <div className="px-4 pb-4 text-sm text-muted-foreground">{day.description}</div>
        </details>
      ))}
    </div>
  )
}
