'use client'

import { useMemo, useState } from 'react'
import { Bus } from 'lucide-react'
import { useApiQuery } from '@/lib/use-api-query'
import { buildQuery } from '@/lib/api-client'
import { Card, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useTranslations, useLanguageStore } from '@/lib/i18n'
import { useCurrency } from '@/hooks/use-currency'
import { formatCurrency } from '@/lib/format'
import type { VehicleSummary } from '@/types/catalog'
import type { Paginated } from '@/types/api'

interface CombinedPricingSummaryProps {
  /** Hotel-stay total in USD for the selected room/dates (nightly × nights). */
  hotelTotalUsd: number
  /** Number of nights, used to estimate a multi-day transport cost. */
  nights: number
}

/**
 * Combined hotel + transportation pricing surface (Section 23.6 — Requirement
 * 37.9). Lets the traveler optionally add a representative transport option
 * alongside their hotel stay and shows a single combined total.
 *
 * Backend gap: there is no combined hotel+transport pricing/quote endpoint, so
 * the combined total is computed CLIENT-SIDE here by summing the hotel-stay
 * total with the selected vehicle's day rate × number of nights. This is an
 * indicative estimate only — actual transport booking still goes through the
 * separate transportation booking flow. If/when a backend combined-quote
 * endpoint exists (e.g. POST /v1/quotes/combined), this estimate should be
 * replaced by the server-authoritative figure.
 *
 * Degrades gracefully: if vehicles can't be loaded, the component renders
 * nothing rather than blocking the hotel booking flow.
 */
export function CombinedPricingSummary({ hotelTotalUsd, nights }: CombinedPricingSummaryProps) {
  const t = useTranslations('bookings')
  const locale = useLanguageStore((s) => s.locale)
  const currency = useCurrency()
  const [vehicleId, setVehicleId] = useState('')

  const { data, error } = useApiQuery<Paginated<VehicleSummary> | VehicleSummary[]>(
    `/v1/transportation${buildQuery({ limit: 20, sort: 'price_asc' })}`,
    { retry: 0 },
  )

  const vehicles: VehicleSummary[] = useMemo(
    () => (data ? (Array.isArray(data) ? data : data.items) : []),
    [data],
  )

  const selected = vehicles.find((v) => v.id === vehicleId) ?? null
  // Estimate transport cost across the stay. Guard against a zero/NaN nights
  // value (e.g. dates not yet chosen) so we never show a negative/NaN total.
  const safeNights = Number.isFinite(nights) && nights > 0 ? nights : 0
  const transportUsd = selected ? selected.pricePerDayUsd * safeNights : 0
  const combinedUsd = hotelTotalUsd + transportUsd

  const money = (amountUsd: number) => formatCurrency(amountUsd, locale, currency)

  // No transport options available (load error / empty) — stay silent.
  if (error || vehicles.length === 0) {
    return null
  }

  return (
    <Card variant="elevated">
      <CardContent className="space-y-3 p-4">
        <h2 className="flex items-center gap-1.5 font-display font-semibold text-foreground">
          <Bus className="h-4 w-4 text-muted-foreground" aria-hidden />
          {t('combined.title')}
        </h2>
        <p className="text-xs text-muted-foreground">{t('combined.intro')}</p>

        <div className="space-y-1.5">
          <Label htmlFor="combined-transport">{t('combined.addTransport')}</Label>
          <Select
            id="combined-transport"
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
          >
            <option value="">{t('combined.none')}</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} — {money(v.pricePerDayUsd)} {t('form.perDay')}
              </option>
            ))}
          </Select>
        </div>

        <dl className="space-y-1.5 border-t border-border pt-2 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">{t('combined.hotel')}</dt>
            <dd className="tabular-nums text-foreground">{money(hotelTotalUsd)}</dd>
          </div>
          {selected ? (
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">
                {t('combined.transport')}
                {safeNights > 0 ? (
                  <span className="ml-1 text-xs">
                    {t('combined.transportDetail', { nights: safeNights })}
                  </span>
                ) : null}
              </dt>
              <dd className="tabular-nums text-foreground">{money(transportUsd)}</dd>
            </div>
          ) : null}
        </dl>

        <div className="flex items-baseline justify-between border-t border-border pt-2">
          <span className="font-medium text-foreground">{t('combined.total')}</span>
          <span className="text-lg font-semibold tabular-nums text-foreground" aria-live="polite">
            {money(combinedUsd)}
          </span>
        </div>

        <p className="text-xs text-muted-foreground">{t('combined.note')}</p>
      </CardContent>
    </Card>
  )
}
