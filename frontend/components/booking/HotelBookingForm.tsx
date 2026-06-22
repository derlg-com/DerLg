'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { v4 as uuid } from 'uuid'
import { useApiQuery } from '@/lib/use-api-query'
import { useZodForm } from '@/lib/use-zod-form'
import { hotelBookingSchema, type HotelBookingValues } from '@/schemas/booking'
import { createHotelBooking, bookingErrorKey } from '@/lib/bookings-api'
import { BookingSummary } from './BookingShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/ui/empty-state'
import { useTranslations, useLanguageStore } from '@/lib/i18n'
import { useCurrency } from '@/hooks/use-currency'
import { formatCurrency } from '@/lib/format'
import type { HotelDetail, HotelRoom } from '@/types/catalog'
import type { Paginated } from '@/types/api'

export function HotelBookingForm({ hotelId, roomId }: { hotelId: string; roomId: string | null }) {
  const t = useTranslations('bookings')
  const router = useRouter()
  const locale = useLanguageStore((s) => s.locale)
  const currency = useCurrency()
  const { data: hotel } = useApiQuery<HotelDetail>(`/v1/hotels/${hotelId}`)
  const { data: roomsData } = useApiQuery<HotelRoom[] | Paginated<HotelRoom>>(
    `/v1/hotels/${hotelId}/rooms`,
  )
  const rooms: HotelRoom[] = roomsData
    ? Array.isArray(roomsData)
      ? roomsData
      : roomsData.items
    : (hotel?.rooms ?? [])
  const room = rooms.find((r) => r.id === roomId)

  const { values, errors, setValue, validate } = useZodForm<HotelBookingValues>(hotelBookingSchema, {
    checkInDate: '',
    checkOutDate: '',
    guestsAdults: 1,
    guestsChildren: 0,
    specialRequests: '',
  })
  const [key] = useState(() => uuid())
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  if (!roomId) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <EmptyState
          title={t('form.selectRoomTitle')}
          description={t('form.selectRoomDesc')}
          action={
            <Button asChild variant="outline" size="sm">
              <Link href={`/hotels/${hotelId}`}>{t('form.backToHotel')}</Link>
            </Button>
          }
        />
      </div>
    )
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    const data = validate()
    if (!data || !roomId) return
    setSubmitting(true)
    createHotelBooking(
      hotelId,
      {
        roomId,
        checkInDate: data.checkInDate,
        checkOutDate: data.checkOutDate,
        guestsAdults: data.guestsAdults,
        guestsChildren: data.guestsChildren,
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
      {hotel ? (
        <BookingSummary
          name={hotel.name}
          imageUrl={room?.imageUrls?.[0] ?? hotel.coverImageUrl}
          subtitle={room?.name}
          priceLabel={
            room ? `${formatCurrency(room.pricePerNightUsd, locale, currency)} ${t('form.perNight')}` : undefined
          }
        />
      ) : null}
      {formError ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="checkInDate">{t('form.checkIn')}</Label>
          <Input
            id="checkInDate"
            type="date"
            value={values.checkInDate}
            onChange={(e) => setValue('checkInDate', e.target.value)}
            aria-invalid={Boolean(errors.checkInDate)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="checkOutDate">{t('form.checkOut')}</Label>
          <Input
            id="checkOutDate"
            type="date"
            value={values.checkOutDate}
            onChange={(e) => setValue('checkOutDate', e.target.value)}
            aria-invalid={Boolean(errors.checkOutDate)}
          />
          {errors.checkOutDate ? (
            <p className="text-sm text-destructive">{errors.checkOutDate}</p>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="guestsAdults">{t('form.adults')}</Label>
          <Input
            id="guestsAdults"
            type="number"
            min={1}
            value={values.guestsAdults}
            onChange={(e) => setValue('guestsAdults', Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="guestsChildren">{t('form.children')}</Label>
          <Input
            id="guestsChildren"
            type="number"
            min={0}
            value={values.guestsChildren}
            onChange={(e) => setValue('guestsChildren', Number(e.target.value))}
          />
        </div>
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
