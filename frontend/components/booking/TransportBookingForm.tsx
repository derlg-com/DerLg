'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuid } from 'uuid'
import { useApiQuery } from '@/lib/use-api-query'
import { useZodForm } from '@/lib/use-zod-form'
import { transportBookingSchema, type TransportBookingValues } from '@/schemas/booking'
import { createTransportBooking, bookingErrorKey } from '@/lib/bookings-api'
import { BookingSummary } from './BookingShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { useTranslations, useLanguageStore } from '@/lib/i18n'
import { useCurrency } from '@/hooks/use-currency'
import { formatCurrency } from '@/lib/format'
import type { VehicleDetail } from '@/types/catalog'

export function TransportBookingForm({ vehicleId }: { vehicleId: string }) {
  const t = useTranslations('bookings')
  const router = useRouter()
  const locale = useLanguageStore((s) => s.locale)
  const currency = useCurrency()
  const { data: vehicle } = useApiQuery<VehicleDetail>(`/v1/transportation/vehicles/${vehicleId}`)
  const { values, errors, setValue, validate } = useZodForm<TransportBookingValues>(
    transportBookingSchema,
    { startDate: '', endDate: '', pickupLocation: '', dropoffLocation: '', specialRequests: '' },
  )
  const [key] = useState(() => uuid())
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    const data = validate()
    if (!data) return
    setSubmitting(true)
    createTransportBooking(
      {
        vehicleId,
        startDate: data.startDate,
        endDate: data.endDate,
        pickupLocation: data.pickupLocation,
        dropoffLocation: data.dropoffLocation,
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

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-lg space-y-4 px-4 py-4" noValidate>
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{t('form.title')}</h1>
      {vehicle ? (
        <BookingSummary
          name={vehicle.name}
          imageUrl={vehicle.imageUrls?.[0] ?? null}
          subtitle={vehicle.type}
          priceLabel={`${formatCurrency(vehicle.pricePerDayUsd, locale, currency)} ${t('form.perDay')}`}
        />
      ) : null}
      {formError ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="startDate">{t('form.startDate')}</Label>
          <Input
            id="startDate"
            type="date"
            value={values.startDate}
            onChange={(e) => setValue('startDate', e.target.value)}
            aria-invalid={Boolean(errors.startDate)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endDate">{t('form.endDate')}</Label>
          <Input
            id="endDate"
            type="date"
            value={values.endDate}
            onChange={(e) => setValue('endDate', e.target.value)}
            aria-invalid={Boolean(errors.endDate)}
          />
          {errors.endDate ? <p className="text-sm text-destructive">{errors.endDate}</p> : null}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pickupLocation">{t('form.pickup')}</Label>
        <Input
          id="pickupLocation"
          value={values.pickupLocation}
          onChange={(e) => setValue('pickupLocation', e.target.value)}
          aria-invalid={Boolean(errors.pickupLocation)}
        />
        {errors.pickupLocation ? (
          <p className="text-sm text-destructive">{errors.pickupLocation}</p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="dropoffLocation">{t('form.dropoff')}</Label>
        <Input
          id="dropoffLocation"
          value={values.dropoffLocation}
          onChange={(e) => setValue('dropoffLocation', e.target.value)}
          aria-invalid={Boolean(errors.dropoffLocation)}
        />
        {errors.dropoffLocation ? (
          <p className="text-sm text-destructive">{errors.dropoffLocation}</p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="specialRequests">{t('form.specialRequests')}</Label>
        <Textarea
          id="specialRequests"
          value={values.specialRequests ?? ''}
          onChange={(e) => setValue('specialRequests', e.target.value)}
          placeholder={t('form.specialRequestsPlaceholder')}
        />
      </div>
      <p className="text-xs text-muted-foreground">{t('form.holdNotice')}</p>
      <Button type="submit" variant="gradient" className="w-full" disabled={submitting}>
        {submitting ? <Spinner size="sm" className="text-primary-foreground" /> : t('form.submit')}
      </Button>
    </form>
  )
}
