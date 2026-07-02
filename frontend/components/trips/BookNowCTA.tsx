'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/format'
import { useCurrency } from '@/hooks/use-currency'
import { useLanguageStore, useTranslations } from '@/lib/i18n'

/**
 * Sticky "Book Now" call-to-action pinned above the bottom nav on the trip
 * detail page (Requirement 36.8 — prominent button that navigates to the
 * booking flow). The price is shown in the user's selected display currency
 * (Requirement 30.x — currency selector) via {@link formatCurrency}.
 *
 * When `disabled` is set (e.g. the trip is inactive / sold out) the CTA renders
 * a non-navigating disabled button so users can't enter a booking flow that the
 * backend would reject.
 */
export function BookNowCTA({
  href,
  priceUsd,
  disabled = false,
}: {
  href: string
  priceUsd: number
  disabled?: boolean
}) {
  const t = useTranslations('trips')
  const locale = useLanguageStore((s) => s.locale)
  const currency = useCurrency()

  return (
    <div
      className="fixed inset-x-0 bottom-16 z-30 glass border-t border-border/60"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-xs text-muted-foreground">{t('detail.from')}</p>
          <p className="font-display text-xl font-bold text-foreground">
            {formatCurrency(priceUsd, locale, currency)}
          </p>
        </div>
        {disabled ? (
          <Button variant="gradient" size="lg" disabled aria-disabled="true">
            {t('detail.unavailable')}
          </Button>
        ) : (
          <Button asChild variant="gradient" size="lg">
            <Link href={href}>{t('detail.bookNow')}</Link>
          </Button>
        )}
      </div>
    </div>
  )
}
