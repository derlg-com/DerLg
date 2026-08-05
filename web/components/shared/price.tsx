'use client'

import { useLocale } from 'next-intl'

import { useCurrency } from '@/hooks/use-currency'
import { useHydrated } from '@/hooks/use-hydrated'
import { cn } from '@/lib/cn'
import { formatPrice } from '@/lib/format'
import { localeTags, type Locale } from '@/lib/i18n/config'

/**
 * Renders a USD amount in the user's chosen display currency.
 *
 * A small client island so cards and lists can stay server components: the
 * currency preference lives in browser storage and is unknown during SSR. USD is
 * rendered first so the server output is meaningful for crawlers, then swapped
 * once hydrated.
 */
export function Price({
  amountUsd,
  className,
  suffix,
}: {
  amountUsd: number
  className?: string
  suffix?: string
}) {
  const locale = useLocale() as Locale
  const { currency } = useCurrency()
  const hydrated = useHydrated()

  const display = formatPrice(amountUsd, hydrated ? currency : 'USD', localeTags[locale])

  return (
    <span className={cn('tabular-nums', className)}>
      {display}
      {suffix ? <span className="text-[var(--text-tertiary)]"> {suffix}</span> : null}
    </span>
  )
}
