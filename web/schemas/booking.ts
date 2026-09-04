import { z } from 'zod'

/**
 * Booking schemas, captured from the LIVE API (a real trip booking was created,
 * confirmed and cancelled to record each shape) rather than inferred from Prisma.
 *
 * Two contract details that bite if assumed:
 *  - `status` comes back UPPERCASE ('HOLD', 'CONFIRMED') but the list filter only
 *    accepts the lowercase Prisma spelling, so a status cannot be echoed straight
 *    back into a query. See BOOKING_STATUS_FILTER below.
 *  - cancelling returns ONLY the refund result, never the updated booking, so the
 *    caller has to refetch to observe the new status.
 */

/** Uppercase statuses as the API RESPONDS with them. */
export const BOOKING_STATUSES = [
  'HOLD',
  'PENDING_PAYMENT',
  'CONFIRMED',
  'CANCELLED',
  'EXPIRED',
  'PAYMENT_FAILED',
  'COMPLETED',
  'NO_SHOW',
] as const

export type BookingStatus = (typeof BOOKING_STATUSES)[number]

/**
 * Lowercase spelling the `?status=` FILTER requires.
 *
 * Verified live: `?status=CANCELLED` returns 400 "status must be one of the
 * following values: hold, pending_payment, confirmed, ...". Responses are
 * uppercase, so the two must be translated explicitly.
 */
export function toStatusFilter(status: BookingStatus): string {
  return status.toLowerCase()
}

export const BOOKING_TYPES = ['trip', 'hotel', 'guide', 'transportation'] as const
export type BookingType = (typeof BOOKING_TYPES)[number]

const BookingItemSchema = z.looseObject({
  id: z.string(),
  name: z.string().nullish(),
  bookingType: z.string().nullish(),
  resourceId: z.string().nullish(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
  quantity: z.number().nullish(),
  unitPriceUsd: z.number().nullish(),
  totalPriceUsd: z.number().nullish(),
  subtotalUsd: z.number().nullish(),
  /** Full resource copy taken at booking time; shape varies per resource type. */
  snapshot: z.unknown().nullish(),
})

/**
 * Bookings are `looseObject` deliberately: this payload is wide (24 fields) and
 * carries server-managed bookkeeping, so an added field must not break parsing.
 */
export const BookingSchema = z.looseObject({
  id: z.string(),
  reference: z.string(),
  type: z.string(),
  name: z.string().nullish(),
  coverImageUrl: z.string().nullish(),
  location: z.string().nullish(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
  status: z.string(),
  totalPriceUsd: z.number(),
  subtotalUsd: z.number().nullish(),
  discountUsd: z.number().nullish(),
  /** 15 minutes from creation; null once confirmed or cancelled. */
  holdExpiresAt: z.string().nullish(),
  specialRequests: z.string().nullish(),
  refundAmountUsd: z.number().nullish(),
  refundPercentage: z.number().nullish(),
  cancelledAt: z.string().nullish(),
  /** Real ticket QR, populated only after confirmation. */
  qrCodeUrl: z.string().nullish(),
  method: z.string().nullish(),
  singleResourceKind: z.string().nullish(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
  items: z.array(BookingItemSchema).nullish(),
})

export type Booking = z.infer<typeof BookingSchema>
export type BookingItem = z.infer<typeof BookingItemSchema>

/** POST /v1/bookings/:id/cancel returns ONLY this — not the updated booking. */
export const RefundResultSchema = z.looseObject({
  refundAmountUsd: z.number(),
  /** Verified tiers: >7 days 100%, 4–7 days 50%, <=3 days 0%. */
  refundPercentage: z.number(),
  refundMethod: z.string().nullish(),
})

export type RefundResult = z.infer<typeof RefundResultSchema>

export const BookingQrSchema = z.looseObject({ qrCodeUrl: z.string() })

/* ------------------------------------------------- creation request bodies */

/**
 * The four resource types take genuinely DIFFERENT bodies and live at different
 * paths, so they are modelled separately rather than forced into one shape.
 * Transport is NOT nested under a resource id — the vehicle goes in the body.
 */
export interface CreateTripBookingBody {
  startDate: string
  travelers: { adults: number; children?: number }
  specialRequests?: string
}

export interface CreateHotelBookingBody {
  roomId: string
  checkInDate: string
  checkOutDate: string
  guestsAdults: number
  guestsChildren?: number
  specialRequests?: string
}

export interface CreateGuideBookingBody {
  startDate: string
  endDate: string
  linkedTripBookingId?: string
  specialRequests?: string
}

export interface CreateTransportBookingBody {
  vehicleId: string
  startDate: string
  endDate: string
  pickupLocation: string
  dropoffLocation: string
  stops?: string[]
  estimatedDistanceKm?: number
  specialRequests?: string
}

/** Payment methods the confirm endpoint accepts. */
export const PAYMENT_METHODS = ['card', 'bakong_qr', 'aba_qr'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/* --------------------------------------------------------------- helpers */

/** A hold is the only state where payment is still expected. */
export function isAwaitingPayment(status: string): boolean {
  return status === 'HOLD' || status === 'PENDING_PAYMENT' || status === 'PAYMENT_FAILED'
}

export function isCancellable(status: string): boolean {
  return status === 'HOLD' || status === 'PENDING_PAYMENT' || status === 'CONFIRMED'
}

/**
 * Refund percentage for a cancellation, mirroring the server's computeRefund.
 *
 * Boundaries are the SERVER's, not the PRD's: the PRD promises 50% down to one day
 * before departure, but the implementation gives 0% from three days out. This
 * preview must match what the server will actually pay, since it is a statement
 * about the user's money.
 */
export function previewRefundPercentage(startDate: string, now: Date = new Date()): 0 | 50 | 100 {
  const start = Date.parse(startDate)
  if (Number.isNaN(start)) return 0

  const startDay = Date.UTC(
    new Date(start).getUTCFullYear(),
    new Date(start).getUTCMonth(),
    new Date(start).getUTCDate(),
  )
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const days = Math.floor((startDay - today) / 86_400_000)

  if (days > 7) return 100
  if (days >= 4) return 50
  return 0
}
