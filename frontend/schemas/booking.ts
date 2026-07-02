import { z } from 'zod'

const optionalNotes = z.string().max(1000).optional().or(z.literal(''))

/**
 * Stable validation message keys. The schema layer is i18n-agnostic, so it
 * emits these keys and the form maps them to `bookings.form.*` translations.
 */
export type BookingValidationKey = 'errorRequired' | 'errorPastDate' | 'errorExceedsCapacity'

/**
 * Normalize a date-input value (`YYYY-MM-DD`) to its calendar day. Returns the
 * ISO day string, or `null` when the value is empty/unparseable. Comparing the
 * day strings avoids timezone drift from `Date` arithmetic.
 */
export function dateOnly(value: string): string | null {
  if (!value) return null
  // <input type="date"> always yields YYYY-MM-DD; guard against other formats.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  return match ? match[0] : null
}

/** True when `value` is a valid date on or after `today` (both YYYY-MM-DD). */
export function isFutureOrToday(value: string, today: string): boolean {
  const day = dateOnly(value)
  return day !== null && day >= today
}

/** Today's calendar day as `YYYY-MM-DD` in the local timezone. */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const tripBookingSchema = z.object({
  startDate: z.string().min(1),
  adults: z.number().int().min(1).max(50),
  children: z.number().int().min(0).max(50),
  specialRequests: optionalNotes,
})

/**
 * Form-bound trip booking schema. Adds two context-dependent rules that the
 * static {@link tripBookingSchema} cannot express:
 *  - the start date must be today or later (Req 5.2 — future dates only), and
 *  - total travelers must not exceed the trip's `maxGuests` capacity when known
 *    (Req 5.1 — guest count within trip limits).
 * Error messages are stable keys (see {@link BookingValidationKey}).
 */
export function createTripBookingSchema(opts: { today: string; maxGuests?: number | null }) {
  const { today, maxGuests } = opts
  return tripBookingSchema
    .refine((d) => isFutureOrToday(d.startDate, today), {
      path: ['startDate'],
      message: 'errorPastDate' satisfies BookingValidationKey,
    })
    .refine((d) => maxGuests == null || maxGuests <= 0 || d.adults + d.children <= maxGuests, {
      path: ['adults'],
      message: 'errorExceedsCapacity' satisfies BookingValidationKey,
    })
}

export const hotelBookingSchema = z
  .object({
    checkInDate: z.string().min(1),
    checkOutDate: z.string().min(1),
    guestsAdults: z.number().int().min(1).max(20),
    guestsChildren: z.number().int().min(0).max(20),
    specialRequests: optionalNotes,
  })
  .refine((d) => d.checkOutDate > d.checkInDate, {
    path: ['checkOutDate'],
    message: 'Check-out must be after check-in',
  })

export const guideBookingSchema = z
  .object({
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    specialRequests: optionalNotes,
  })
  .refine((d) => d.endDate >= d.startDate, {
    path: ['endDate'],
    message: 'End date must be on or after start date',
  })

export const transportBookingSchema = z
  .object({
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    pickupLocation: z.string().min(1).max(500),
    dropoffLocation: z.string().min(1).max(500),
    specialRequests: optionalNotes,
  })
  .refine((d) => d.endDate >= d.startDate, {
    path: ['endDate'],
    message: 'End date must be on or after start date',
  })

export type TripBookingValues = z.infer<typeof tripBookingSchema>
export type HotelBookingValues = z.infer<typeof hotelBookingSchema>
export type GuideBookingValues = z.infer<typeof guideBookingSchema>
export type TransportBookingValues = z.infer<typeof transportBookingSchema>
