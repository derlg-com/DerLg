'use client'

import { CalendarCheck, Info, MapPin, Ticket } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useTranslations } from '@/lib/i18n'
import type { BookingType } from '@/types/api'

interface NextStepsProps {
  /** Booking type drives which preparation tips are shown. */
  type: BookingType | string
}

/** Booking types we have tailored preparation tips for. */
const KNOWN_TYPES: readonly BookingType[] = ['trip', 'hotel', 'guide', 'transportation']

function isKnownType(type: string): type is BookingType {
  return (KNOWN_TYPES as readonly string[]).includes(type)
}

/**
 * Next steps & preparation instructions (Requirement 39.9).
 *
 * The booking payload does not (yet) carry per-trip preparation notes, so we
 * render type-appropriate, i18n-driven guidance (e.g. arrive early, bring ID).
 * The three tips per type live under `checkout.nextSteps.<type>.{1,2,3}` with a
 * generic fallback so an unrecognised type still renders something useful.
 */
export function NextSteps({ type }: NextStepsProps) {
  const t = useTranslations('checkout')
  const group = isKnownType(type) ? type : 'generic'
  const icons = [CalendarCheck, Ticket, MapPin]

  const tips = [1, 2, 3].map((n) =>
    t(`nextSteps.${group}.${n}`, undefined, `nextSteps.generic.${n}`),
  )

  return (
    <Card data-testid="next-steps">
      <CardContent className="space-y-3 p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Info className="h-4 w-4 text-primary" aria-hidden />
          {t('nextSteps.title')}
        </h2>
        <ul className="space-y-2">
          {tips.map((tip, i) => {
            const Icon = icons[i] ?? Info
            return (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span>{tip}</span>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
