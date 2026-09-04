'use client'

import { useTranslations } from 'next-intl'
import * as React from 'react'

import { Price } from '@/components/shared/price'
import { Button, Field, Input, Textarea, buttonVariants } from '@/components/ui'
import { useCreateBooking, type CreateBookingInput } from '@/hooks/use-bookings'
import { ApiError } from '@/lib/api/errors'
import { cn } from '@/lib/cn'
import { Link, useRouter } from '@/lib/i18n/navigation'

/**
 * Booking form.
 *
 * One component with per-type fields rather than four near-duplicate forms: the
 * shared parts (special requests, price summary, submission, error handling) are
 * the bulk of it, and the differences are a handful of inputs.
 */

export type BookingKind = 'trip' | 'hotel' | 'guide' | 'transport'

export interface BookingFormProps {
  kind: BookingKind
  resourceId: string
  name: string
  unitPriceUsd: number
  /** Hotels arrive with a room and dates already chosen on the hotel page. */
  roomId?: string
  initialCheckIn?: string
  initialCheckOut?: string
  /** 'per person' / 'per night' / 'per day' suffix. */
  unitLabel: string
}

/** Tomorrow, so the default is never a past date the server would reject. */
function tomorrow(): string {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return date.toISOString().slice(0, 10)
}

function addDays(iso: string, days: number): string {
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return iso
  const date = new Date(parsed)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

export function BookingForm({
  kind,
  resourceId,
  name,
  unitPriceUsd,
  roomId,
  initialCheckIn,
  initialCheckOut,
  unitLabel,
}: BookingFormProps) {
  const t = useTranslations('bookings.form')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const createBooking = useCreateBooking()

  const [startDate, setStartDate] = React.useState(initialCheckIn ?? tomorrow())
  const [endDate, setEndDate] = React.useState(
    initialCheckOut ?? addDays(initialCheckIn ?? tomorrow(), kind === 'trip' ? 0 : 1),
  )
  const [adults, setAdults] = React.useState(1)
  const [children, setChildren] = React.useState(0)
  const [pickup, setPickup] = React.useState('')
  const [dropoff, setDropoff] = React.useState('')
  const [specialRequests, setSpecialRequests] = React.useState('')

  const needsEndDate = kind !== 'trip'
  const needsGuests = kind === 'trip' || kind === 'hotel'
  const needsRoute = kind === 'transport'

  const today = new Date().toISOString().slice(0, 10)
  const datesInvalid = needsEndDate && Date.parse(endDate) <= Date.parse(startDate)
  const startInPast = Date.parse(startDate) < Date.parse(today)
  const routeMissing = needsRoute && (!pickup.trim() || !dropoff.trim())

  /*
   * Children are charged the FULL per-person price — verified live: 2 adults + 1
   * child on a $399 trip produced quantity 3 and a $1197 total. Showing a lower
   * estimate than the server will charge would be a lie about price.
   */
  const quantity = needsGuests ? adults + children : 1
  const estimate = unitPriceUsd * quantity

  const canSubmit = !datesInvalid && !startInPast && !routeMissing && !createBooking.isPending

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return

    const trimmedRequests = specialRequests.trim()
    const requests = trimmedRequests ? { specialRequests: trimmedRequests } : {}

    const input: CreateBookingInput =
      kind === 'trip'
        ? {
            type: 'trip',
            id: resourceId,
            body: {
              startDate,
              travelers: { adults, ...(children > 0 ? { children } : {}) },
              ...requests,
            },
          }
        : kind === 'hotel'
          ? {
              type: 'hotel',
              id: resourceId,
              body: {
                // The hotel page picks the room; the form cannot invent one.
                roomId: roomId ?? '',
                checkInDate: startDate,
                checkOutDate: endDate,
                guestsAdults: adults,
                ...(children > 0 ? { guestsChildren: children } : {}),
                ...requests,
              },
            }
          : kind === 'guide'
            ? { type: 'guide', id: resourceId, body: { startDate, endDate, ...requests } }
            : {
                type: 'transport',
                body: {
                  vehicleId: resourceId,
                  startDate,
                  endDate,
                  pickupLocation: pickup.trim(),
                  dropoffLocation: dropoff.trim(),
                  ...requests,
                },
              }

    createBooking.mutate(input, {
      // Straight to checkout: the hold is already ticking.
      onSuccess: (booking) => router.push(`/bookings/${booking.id}`),
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label={kind === 'hotel' ? t('checkIn') : t('startDate')}
          required
          error={startInPast ? t('errorPast') : undefined}
        >
          {(props) => (
            <Input
              {...props}
              type="date"
              name="startDate"
              value={startDate}
              min={today}
              onChange={(event) => setStartDate(event.target.value)}
            />
          )}
        </Field>

        {needsEndDate ? (
          <Field
            label={kind === 'hotel' ? t('checkOut') : t('endDate')}
            required
            error={datesInvalid ? t('errorInvalidDates') : undefined}
          >
            {(props) => (
              <Input
                {...props}
                type="date"
                name="endDate"
                value={endDate}
                min={addDays(startDate, 1)}
                onChange={(event) => setEndDate(event.target.value)}
              />
            )}
          </Field>
        ) : null}

        {needsGuests ? (
          <>
            <Field label={t('adults')} required>
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  name="adults"
                  min={1}
                  max={20}
                  value={adults}
                  onChange={(event) => setAdults(Math.max(1, Number(event.target.value) || 1))}
                />
              )}
            </Field>
            <Field label={t('children')}>
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  name="children"
                  min={0}
                  max={20}
                  value={children}
                  onChange={(event) => setChildren(Math.max(0, Number(event.target.value) || 0))}
                />
              )}
            </Field>
          </>
        ) : null}

        {needsRoute ? (
          <>
            <Field label={t('pickup')} required>
              {(props) => (
                <Input
                  {...props}
                  name="pickupLocation"
                  value={pickup}
                  maxLength={500}
                  onChange={(event) => setPickup(event.target.value)}
                />
              )}
            </Field>
            <Field label={t('dropoff')} required>
              {(props) => (
                <Input
                  {...props}
                  name="dropoffLocation"
                  value={dropoff}
                  maxLength={500}
                  onChange={(event) => setDropoff(event.target.value)}
                />
              )}
            </Field>
          </>
        ) : null}
      </div>

      <Field label={t('specialRequests')}>
        {(props) => (
          <Textarea
            {...props}
            name="specialRequests"
            rows={3}
            maxLength={1000}
            placeholder={t('specialRequestsPlaceholder')}
            value={specialRequests}
            onChange={(event) => setSpecialRequests(event.target.value)}
          />
        )}
      </Field>

      <section
        aria-label={t('priceTitle')}
        className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3"
      >
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t('priceTitle')}</h2>

        <dl className="mt-2 flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-sm text-[var(--text-secondary)]">
              {name}
              <span className="text-[var(--text-tertiary)]">
                {' '}
                {t('priceLineDetail', { quantity, unit: unitLabel })}
              </span>
            </dt>
            <dd className="text-sm text-[var(--text-primary)]">
              <Price amountUsd={estimate} />
            </dd>
          </div>
        </dl>

        <div className="mt-2 flex items-baseline justify-between gap-2 border-t border-[var(--border-subtle)] pt-2">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{t('priceTotal')}</p>
          <p className="text-base font-semibold text-[var(--text-primary)]">
            <Price amountUsd={estimate} />
          </p>
        </div>

        {needsGuests && children > 0 ? (
          <p className="mt-1.5 text-xs text-[var(--text-tertiary)]">{t('priceChildrenNote')}</p>
        ) : null}
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">{t('priceEstimateNote')}</p>
      </section>

      <p className="text-xs text-[var(--text-tertiary)]">{t('holdNotice')}</p>

      {createBooking.isError ? (
        <p
          className="rounded-[var(--radius-md)] bg-[var(--tone-danger-bg)] px-3 py-2 text-sm text-[var(--tone-danger-text)]"
          role="alert"
        >
          {bookingErrorMessage(createBooking.error, t)}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={!canSubmit} loading={createBooking.isPending}>
          {t('submit')}
        </Button>
        <Link
          href={hrefForKind(kind, resourceId)}
          className={cn(buttonVariants({ variant: 'ghost' }))}
        >
          {tCommon('cancel')}
        </Link>
      </div>
    </form>
  )
}

/** Back to the resource the user came from, not a generic list. */
function hrefForKind(kind: BookingKind, id: string): string {
  switch (kind) {
    case 'trip':
      return `/trips/${id}`
    case 'hotel':
      return `/hotels/${id}`
    case 'guide':
      return `/guides/${id}`
    case 'transport':
      return `/transport/${id}`
  }
}

/**
 * Maps a failure to copy the user can act on.
 *
 * A double-booking and an invalid date need different responses, so they are
 * distinguished rather than collapsed into one generic message.
 */
function bookingErrorMessage(
  error: unknown,
  t: ReturnType<typeof useTranslations<'bookings.form'>>,
): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return t('errorConflict')
    if (error.isValidation) return t('errorInvalidDates')
    if (error.isNotFound) return t('errorUnavailable')
  }
  return t('errorGeneric')
}
