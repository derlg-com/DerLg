'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { api, ApiError } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { useTranslations, useLanguageStore } from '@/lib/i18n'
import { useCurrency } from '@/hooks/use-currency'
import { formatCurrency } from '@/lib/format'
import type { GuideAvailability } from '@/types/catalog'

export function GuideAvailabilityChecker({ guideId }: { guideId: string }) {
  const t = useTranslations('guides')
  const locale = useLanguageStore((s) => s.locale)
  const currency = useCurrency()
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [result, setResult] = useState<GuideAvailability | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function check() {
    if (!start || !end) return
    setLoading(true)
    setError(null)
    setResult(null)
    api
      .get<GuideAvailability>(`/v1/guides/${guideId}/availability?startDate=${start}&endDate=${end}`)
      .then((r) => {
        setResult(r)
        setLoading(false)
      })
      .catch((e: unknown) => {
        setError(e instanceof ApiError ? e.message : t('availability.error'))
        setLoading(false)
      })
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="gav-start">{t('availability.start')}</Label>
          <Input id="gav-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gav-end">{t('availability.end')}</Label>
          <Input id="gav-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>
      <Button onClick={check} disabled={!start || !end || loading} className="w-full">
        {loading ? <Spinner size="sm" className="text-primary-foreground" /> : t('availability.check')}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {result ? (
        result.isAvailable ? (
          <p className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            {t('availability.available')}
            {result.priceEstimateUsd != null
              ? ` · ${formatCurrency(result.priceEstimateUsd, locale, currency)}`
              : ''}
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-destructive">
            <XCircle className="h-4 w-4" aria-hidden />
            {t('availability.unavailable')}
          </p>
        )
      ) : null}
    </div>
  )
}
