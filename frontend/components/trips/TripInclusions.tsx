'use client'

import { Check, X } from 'lucide-react'
import { useTranslations } from '@/lib/i18n'

export function TripInclusions({ included, excluded }: { included: string[]; excluded: string[] }) {
  const t = useTranslations('trips')
  const hasIncluded = included && included.length > 0
  const hasExcluded = excluded && excluded.length > 0
  if (!hasIncluded && !hasExcluded) return null

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {hasIncluded ? (
        <div>
          <h3 className="mb-2 font-medium text-foreground">{t('detail.included')}</h3>
          <ul className="space-y-1.5">
            {included.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {hasExcluded ? (
        <div>
          <h3 className="mb-2 font-medium text-foreground">{t('detail.excluded')}</h3>
          <ul className="space-y-1.5">
            {excluded.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
