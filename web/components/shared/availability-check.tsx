'use client'

import { CalendarCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'

import { Badge, Card, Field, Input, Skeleton } from '@/components/ui'

/** ISO date offset from today, used for sensible initial values. */
function isoDate(offsetDays: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}

interface AvailabilityResult {
  busyRanges: unknown[]
}

/**
 * Date-window availability check shared by guides and vehicles.
 *
 * The API reports busy ranges, so "available" means the list came back empty for
 * the requested window. That inversion is stated in the UI copy rather than left
 * implicit, and the query never fires with an invalid range because the backend
 * rejects it.
 */
export function AvailabilityCheck({
  useAvailability,
  id,
}: {
  useAvailability: (
    id: string,
    range: { from?: string; to?: string },
  ) => {
    data?: AvailabilityResult
    isFetching: boolean
    isError: boolean
  }
  id: string
}) {
  const catalog = useTranslations('catalog')
  const common = useTranslations('common')

  const [from, setFrom] = React.useState(() => isoDate(1))
  const [to, setTo] = React.useState(() => isoDate(3))

  const valid = from !== '' && to !== '' && to > from
  const { data, isFetching, isError } = useAvailability(id, {
    from: valid ? from : undefined,
    to: valid ? to : undefined,
  })

  const busyCount = data?.busyRanges.length ?? 0

  return (
    <Card className="space-y-4 p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
        <CalendarCheck aria-hidden="true" className="size-4 text-[var(--accent)]" />
        {catalog('detail.checkAvailability')}
      </h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={catalog('availability.from')}>
          {(props) => (
            <Input
              {...props}
              type="date"
              value={from}
              min={isoDate(0)}
              onChange={(event) => setFrom(event.target.value)}
            />
          )}
        </Field>
        <Field
          label={catalog('availability.to')}
          error={valid ? undefined : catalog('availability.selectDates')}
        >
          {(props) => (
            <Input
              {...props}
              type="date"
              value={to}
              min={from || isoDate(1)}
              onChange={(event) => setTo(event.target.value)}
            />
          )}
        </Field>
      </div>

      <div aria-live="polite">
        {!valid ? null : isFetching ? (
          <Skeleton className="h-6 w-32" />
        ) : isError ? (
          <p className="text-sm text-[var(--text-danger)]">{common('error')}</p>
        ) : busyCount === 0 ? (
          <Badge tone="success">{catalog('availability.available')}</Badge>
        ) : (
          <Badge tone="warning">{catalog('availability.unavailable')}</Badge>
        )}
      </div>
    </Card>
  )
}
