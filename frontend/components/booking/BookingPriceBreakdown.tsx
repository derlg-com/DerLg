'use client'

import { Card } from '@/components/ui/card'
import { useTranslations, useLanguageStore } from '@/lib/i18n'
import { useCurrency } from '@/hooks/use-currency'
import { formatCurrency } from '@/lib/format'
import { computeTripPrice } from '@/lib/booking-pricing'

interface BookingPriceBreakdownProps {
  /** Per-person price in USD (trip.priceUsd). */
  pricePerPersonUsd: number
  adults: number
  childrenCount: number
  /** Optional discount magnitude in USD (e.g. approved student discount). */
  discountUsd?: number
}

const LINE_LABEL_KEYS: Record<string, string> = {
  adults: 'form.priceAdults',
  children: 'form.priceChildren',
  discount: 'form.priceDiscount',
}

/**
 * Live trip-booking cost breakdown (task 11.3, Req 5.4). Recomputes whenever the
 * traveler counts change and renders amounts in the user's selected display
 * currency. Children are charged at the full per-person price (Req noted in
 * `lib/booking-pricing`). Student discount (Req 5.5) and loyalty points (Req
 * 5.6 / 34.3) lines render only when the corresponding values are provided,
 * since the trip booking engine does not currently model them.
 */
export function BookingPriceBreakdown({
  pricePerPersonUsd,
  adults,
  childrenCount,
  discountUsd,
}: BookingPriceBreakdownProps) {
  const t = useTranslations('bookings')
  const locale = useLanguageStore((s) => s.locale)
  const currency = useCurrency()

  const breakdown = computeTripPrice({
    pricePerPersonUsd,
    adults,
    children: childrenCount,
    discountUsd,
  })
  const money = (amountUsd: number) => formatCurrency(amountUsd, locale, currency)

  return (
    <Card variant="elevated" className="space-y-3 p-4" aria-label={t('form.priceTitle')}>
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-foreground">{t('form.priceTitle')}</h2>
        <span className="text-sm text-muted-foreground">
          {t('form.priceTravelers', { count: breakdown.totalTravelers })}
        </span>
      </div>

      <dl className="space-y-1.5 text-sm">
        {breakdown.lines.map((line) => (
          <div key={line.key} className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">
              {t(LINE_LABEL_KEYS[line.key] ?? `form.${line.key}`)}
              {line.quantity != null && line.unitUsd != null ? (
                <span className="ml-1 text-xs">
                  {t('form.priceLineDetail', {
                    quantity: line.quantity,
                    unit: money(line.unitUsd),
                  })}
                </span>
              ) : null}
            </dt>
            <dd
              className={
                line.amountUsd < 0 ? 'tabular-nums text-success' : 'tabular-nums text-foreground'
              }
            >
              {line.amountUsd < 0 ? `−${money(Math.abs(line.amountUsd))}` : money(line.amountUsd)}
            </dd>
          </div>
        ))}

        {breakdown.discountUsd > 0 ? (
          <div className="flex items-baseline justify-between gap-3 border-t border-border pt-1.5">
            <dt className="text-muted-foreground">{t('form.priceSubtotal')}</dt>
            <dd className="tabular-nums text-muted-foreground">{money(breakdown.subtotalUsd)}</dd>
          </div>
        ) : null}
      </dl>

      <div className="flex items-baseline justify-between border-t border-border pt-2">
        <span className="font-medium text-foreground">{t('form.priceTotal')}</span>
        <span className="text-lg font-semibold text-foreground tabular-nums" aria-live="polite">
          {money(breakdown.totalUsd)}
        </span>
      </div>

      {breakdown.children > 0 ? (
        <p className="text-xs text-muted-foreground">{t('form.priceChildrenNote')}</p>
      ) : null}
      <p className="text-xs text-muted-foreground">{t('form.priceEstimateNote')}</p>
    </Card>
  )
}
