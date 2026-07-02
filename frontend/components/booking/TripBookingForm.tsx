'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuid } from 'uuid'
import { useApiQuery } from '@/lib/use-api-query'
import { useZodForm } from '@/lib/use-zod-form'
import {
  createTripBookingSchema,
  isFutureOrToday,
  todayIso,
  type TripBookingValues,
} from '@/schemas/booking'
import { createTripBooking, bookingErrorKey } from '@/lib/bookings-api'
import { BookingSummary, BookingNotFound } from './BookingShell'
import { BookingPriceBreakdown } from './BookingPriceBreakdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { useTranslations, useLanguageStore } from '@/lib/i18n'
import { useCurrency } from '@/hooks/use-currency'
import { formatCurrency } from '@/lib/format'
import type { TripDetail } from '@/types/catalog'

export function TripBookingForm({ tripId }: { tripId: string }) {
  const t = useTranslations('bookings')
  const router = useRouter()
  const locale = useLanguageStore((s) => s.locale)
  const currency = useCurrency()
  const { data: trip, error: tripError } = useApiQuery<TripDetail>(`/v1/trips/${tripId}`)
  const today = useMemo(() => todayIso(), [])
  const maxGuests = trip?.maxGuests ?? null
  const schema = useMemo(() => createTripBookingSchema({ today, maxGuests }), [today, maxGuests])
  const { values, errors, setValue, validate, validateField } = useZodForm<TripBookingValues>(
    schema,
    {
      startDate: '',
      adults: 1,
      children: 0,
      specialRequests: '',
    },
  )
  const [key] = useState(() => uuid())
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Translate the schema's stable error keys into localized, accessible copy.
  const errorText = (raw?: string): string | undefined => {
    if (!raw) return undefined
    if (raw === 'errorPastDate') return t('form.errorPastDate')
    if (raw === 'errorExceedsCapacity')
      return t('form.errorExceedsCapacity', { max: maxGuests ?? 0 })
    return t('form.errorRequired')
  }

  // Mirror the schema's required + business rules to gate the submit button
  // (Req 16.5) without surfacing errors for untouched fields.
  const totalTravelers = values.adults + values.children
  const isValid =
    isFutureOrToday(values.startDate, today) &&
    values.adults >= 1 &&
    values.children >= 0 &&
    (maxGuests == null || maxGuests <= 0 || totalTravelers <= maxGuests)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    const data = validate()
    if (!data) return
    setSubmitting(true)
    createTripBooking(
      tripId,
      {
        startDate: data.startDate,
        travelers: { adults: data.adults, children: data.children },
        specialRequests: data.specialRequests || undefined,
      },
      key,
    )
      .then((r) => router.push(`/checkout/${r.id}/payment-method`))
      .catch((err: unknown) => {
        setSubmitting(false)
        setFormError(t(`form.${bookingErrorKey(err)}`))
      })
  }

  // Invalid / stale trip id surfaces as a fetch error (e.g. 404). Don't render a
  // booking form for something that doesn't exist — offer a way back instead.
  if (tripError) {
    return <BookingNotFound backHref="/trips" />
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-lg space-y-4 px-4 py-4" noValidate>
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
        {t('form.title')}
      </h1>
      {trip ? (
        <BookingSummary
          name={trip.name}
          imageUrl={trip.coverImageUrl}
          subtitle={trip.location}
          priceLabel={`${formatCurrency(trip.priceUsd, locale, currency)} ${t('form.perPerson')}`}
        />
      ) : null}
      {formError ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="startDate">{t('form.startDate')}</Label>
        <Input
          id="startDate"
          type="date"
          min={today}
          value={values.startDate}
          onChange={(e) => setValue('startDate', e.target.value)}
          onBlur={() => validateField('startDate')}
          aria-invalid={Boolean(errors.startDate)}
          aria-describedby={errors.startDate ? 'startDate-error' : undefined}
        />
        {errors.startDate ? (
          <p id="startDate-error" className="text-sm text-destructive">
            {errorText(errors.startDate)}
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="adults">{t('form.adults')}</Label>
          <Input
            id="adults"
            type="number"
            min={1}
            max={maxGuests ?? undefined}
            value={values.adults}
            onChange={(e) => setValue('adults', Number(e.target.value))}
            onBlur={() => validateField('adults')}
            aria-invalid={Boolean(errors.adults)}
            aria-describedby={errors.adults ? 'adults-error' : undefined}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="children">{t('form.children')}</Label>
          <Input
            id="children"
            type="number"
            min={0}
            max={maxGuests ?? undefined}
            value={values.children}
            onChange={(e) => setValue('children', Number(e.target.value))}
            onBlur={() => validateField('children')}
            aria-invalid={Boolean(errors.children)}
          />
        </div>
      </div>
      {errors.adults ? (
        <p id="adults-error" className="text-sm text-destructive">
          {errorText(errors.adults)}
        </p>
      ) : maxGuests && maxGuests > 0 ? (
        <p className="text-xs text-muted-foreground">
          {t('form.maxGuestsNotice', { max: maxGuests })}
        </p>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="specialRequests">{t('form.specialRequests')}</Label>
        <Textarea
          id="specialRequests"
          value={values.specialRequests ?? ''}
          maxLength={1000}
          onChange={(e) => setValue('specialRequests', e.target.value)}
          placeholder={t('form.specialRequestsPlaceholder')}
        />
      </div>
      <p className="text-xs text-muted-foreground">{t('form.holdNotice')}</p>
      {trip ? (
        <BookingPriceBreakdown
          pricePerPersonUsd={trip.priceUsd}
          adults={values.adults}
          childrenCount={values.children}
        />
      ) : null}
      <Button type="submit" variant="gradient" className="w-full" disabled={submitting || !isValid}>
        {submitting ? <Spinner size="sm" className="text-primary-foreground" /> : t('form.submit')}
      </Button>
    </form>
  )
}
