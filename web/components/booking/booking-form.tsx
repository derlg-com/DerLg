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

  const durationDays =
    needsEndDate && !datesInvalid
      ? Math.max(1, Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000))
      : 1

  /*
   * Trips are charged per-traveler (adults + children).
   * Hotels, guides, and transportation (per-day) are charged per day/night.
   */
  const quantity =
    kind === 'trip'
      ? adults + children
      : durationDays
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
          <div className="sm:col-span-2 space-y-3 rounded-2xl bg-[var(--surface-raised)] border border-[var(--border-subtle)] p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[#1B3232] dark:text-white">
                {t('adults')} (Person)
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#1B3232] dark:bg-[#3D9676] text-white shadow-xs">
                {adults} {adults > 1 ? 'Persons' : 'Person'}
              </span>
            </div>

            {/* NAVEL Person Slider */}
            <div className="space-y-1 pt-1">
              <input
                type="range"
                min={1}
                max={20}
                value={adults}
                onChange={(e) => setAdults(Number(e.target.value))}
                className="w-full h-2 rounded-lg bg-neutral-200 dark:bg-neutral-800 accent-[#1B3232] dark:accent-[#3D9676] cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-[var(--text-tertiary)] font-medium">
                <span>1 person</span>
                <span>10 person</span>
                <span>20 person</span>
              </div>
            </div>

            {/* Quick buttons */}
            <div className="flex items-center gap-2 pt-1 overflow-x-auto no-scrollbar">
              {[1, 2, 3, 4, 5, 6].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setAdults(num)}
                  className={cn(
                    'size-9 rounded-xl text-xs font-bold shrink-0 transition-all duration-200 active:scale-95',
                    adults === num
                      ? 'bg-[#1B3232] dark:bg-[#3D9676] text-white shadow-xs'
                      : 'bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:border-[#1B3232]',
                  )}
                >
                  {num}
                </button>
              ))}
            </div>

            {/* Children field */}
            <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between">
              <span className="text-xs text-[var(--text-secondary)]">{t('children')}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={children <= 0}
                  onClick={() => setChildren((prev) => Math.max(0, prev - 1))}
                  className="size-8 rounded-lg bg-[var(--surface)] border border-[var(--border-subtle)] flex items-center justify-center font-bold text-sm disabled:opacity-40"
                >
                  -
                </button>
                <input
                  type="number"
                  name="children"
                  aria-label={t('children')}
                  min={0}
                  max={20}
                  value={children}
                  onChange={(e) => setChildren(Math.max(0, Number(e.target.value) || 0))}
                  className="w-12 text-center text-xs font-bold bg-transparent border border-[var(--border-subtle)] rounded py-1 focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring)]"
                />
                <button
                  type="button"
                  onClick={() => setChildren((prev) => Math.min(10, prev + 1))}
                  className="size-8 rounded-lg bg-[var(--surface)] border border-[var(--border-subtle)] flex items-center justify-center font-bold text-sm"
                >
                  +
                </button>
              </div>
            </div>
          </div>
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
        className="rounded-2xl border border-[var(--border-subtle)] bg-[#F5EADD]/40 dark:bg-[#1A2626] p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#1B3232] dark:text-white">{t('priceTitle')}</h2>
          <span className="text-xs font-semibold text-[#3D9676]">Best price guarantee</span>
        </div>

        <dl className="flex flex-col gap-1.5 text-xs text-[var(--text-secondary)]">
          <div className="flex items-baseline justify-between gap-2">
            <dt className="truncate max-w-[200px]">
              {name} ({quantity} {unitLabel})
            </dt>
            <dd className="font-semibold text-[var(--text-primary)]">
              <Price amountUsd={estimate} />
            </dd>
          </div>
        </dl>

        <div className="flex items-baseline justify-between gap-2 border-t border-[#B1A699]/30 pt-3">
          <p className="text-sm font-bold text-[#1B3232] dark:text-white">{t('priceTotal')}</p>
          <p className="text-2xl font-bold text-[#1B3232] dark:text-[#3D9676]">
            <Price amountUsd={estimate} />
          </p>
        </div>

        {kind === 'trip' && children > 0 ? (
          <p className="text-[11px] text-[var(--text-tertiary)]">{t('priceChildrenNote')}</p>
        ) : null}
      </section>

      <p className="text-[11px] text-[var(--text-tertiary)] px-1">{t('holdNotice')}</p>

      {createBooking.isError ? (
        <p
          className="rounded-2xl bg-[var(--tone-danger-bg)] px-4 py-3 text-xs text-[var(--tone-danger-text)] font-medium"
          role="alert"
        >
          {bookingErrorMessage(createBooking.error, t)}
        </p>
      ) : null}

      <div className="space-y-2 pt-2">
        <Button
          type="submit"
          variant="navelPrimary"
          size="xl"
          block
          disabled={!canSubmit}
          loading={createBooking.isPending}
          className="shadow-md"
        >
          {t('submit')}
        </Button>
        <Link
          href={hrefForKind(kind, resourceId)}
          className={cn(
            buttonVariants({ variant: 'ghost' }),
            'w-full text-xs text-[#B1A699] hover:text-[var(--text-primary)] flex justify-center py-2',
          )}
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
