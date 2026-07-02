'use client'

import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/lib/i18n'
import { useCurrency } from '@/hooks/use-currency'

/**
 * Small disclaimer shown near currency selectors (task 28.2 / Requirement 44.7):
 * converted prices are estimates and the actual charge is in USD.
 *
 * Renders nothing when the active currency is USD (no conversion happening), so
 * it only appears where it adds value.
 */
export function CurrencyDisclaimer({ className }: { className?: string }) {
  const t = useTranslations('currency')
  const currency = useCurrency()

  if (currency === 'USD') return null

  return (
    <p
      className={cn('flex items-start gap-1.5 text-xs text-muted-foreground', className)}
      role="note"
    >
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{t('disclaimer')}</span>
    </p>
  )
}
