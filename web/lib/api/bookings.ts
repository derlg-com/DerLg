import { api } from './client'
import {
  BookingQrSchema,
  BookingSchema,
  RefundResultSchema,
  toStatusFilter,
  type Booking,
  type BookingStatus,
  type CreateGuideBookingBody,
  type CreateHotelBookingBody,
  type CreateTransportBookingBody,
  type CreateTripBookingBody,
  type PaymentMethod,
  type RefundResult,
} from '@/schemas/booking'
import { PaginatedSchema } from '@/schemas/domain'
import type { Paginated } from './errors'
import type { Locale } from '@/lib/i18n/config'

/**
 * Bookings API.
 *
 * Every call is authenticated — bookings are owned and the backend enforces
 * ownership, so there is no unauthenticated path here.
 */

export interface BookingFilters {
  page?: number
  limit?: number
  /** Uppercase, as the app knows it; translated to the filter spelling below. */
  status?: BookingStatus
}

/**
 * A fresh idempotency key per booking ATTEMPT.
 *
 * All five creation endpoints read `Idempotency-Key`, which is what stops a
 * double-tap, or a retry after a timeout, creating two holds for the same trip.
 */
export function newIdempotencyKey(): string {
  return crypto.randomUUID()
}

export const bookingsApi = {
  async list(
    token: string,
    locale: Locale,
    filters: BookingFilters = {},
  ): Promise<Paginated<Booking>> {
    const data = await api.list<unknown>('bookings', {
      locale,
      token,
      query: {
        page: filters.page,
        limit: filters.limit,
        // Responses are UPPERCASE but the filter only accepts lowercase.
        status: filters.status ? toStatusFilter(filters.status) : undefined,
      },
    })
    return PaginatedSchema(BookingSchema).parse(data) as Paginated<Booking>
  },

  async detail(token: string, locale: Locale, id: string): Promise<Booking> {
    const data = await api.get<unknown>(`bookings/${id}`, { locale, token })
    return BookingSchema.parse(data)
  },

  /**
   * SANDBOX-only confirmation. Marks the booking paid WITHOUT any charge, and only
   * when the server has DEMO_PAYMENTS enabled — otherwise it returns 403
   * PAY_METHOD_NOT_SUPPORTED.
   *
   * NOT part of the real payment flow. Real payments go through `paymentsApi`
   * (`POST /v1/payments/intents` + `GET /v1/payments/status`); this wrapper is kept
   * deliberately so a developer can still settle a booking from the app against a
   * local demo server or seeded fixtures. It has no UI caller by design.
   */
  async confirm(
    token: string,
    locale: Locale,
    id: string,
    method: PaymentMethod,
  ): Promise<Booking> {
    const data = await api.post<unknown>(`bookings/${id}/confirm`, { method }, { locale, token })
    return BookingSchema.parse(data)
  },

  /** Returns ONLY the refund result; refetch the booking to see its new status. */
  async cancel(
    token: string,
    locale: Locale,
    id: string,
    reason?: string,
  ): Promise<RefundResult> {
    const data = await api.post<unknown>(
      `bookings/${id}/cancel`,
      reason ? { reason } : {},
      { locale, token },
    )
    return RefundResultSchema.parse(data)
  },

  async qr(token: string, locale: Locale, id: string): Promise<{ qrCodeUrl: string }> {
    const data = await api.get<unknown>(`bookings/${id}/qr`, { locale, token })
    return BookingQrSchema.parse(data)
  },

  /* ------------------------------------------------------------- creation */

  async createTripBooking(
    token: string,
    locale: Locale,
    tripId: string,
    body: CreateTripBookingBody,
    idempotencyKey: string,
  ): Promise<Booking> {
    const data = await api.post<unknown>(`trips/${tripId}/bookings`, body, {
      locale,
      token,
      idempotencyKey,
    })
    return BookingSchema.parse(data)
  },

  async createHotelBooking(
    token: string,
    locale: Locale,
    hotelId: string,
    body: CreateHotelBookingBody,
    idempotencyKey: string,
  ): Promise<Booking> {
    const data = await api.post<unknown>(`hotels/${hotelId}/bookings`, body, {
      locale,
      token,
      idempotencyKey,
    })
    return BookingSchema.parse(data)
  },

  async createGuideBooking(
    token: string,
    locale: Locale,
    guideId: string,
    body: CreateGuideBookingBody,
    idempotencyKey: string,
  ): Promise<Booking> {
    const data = await api.post<unknown>(`guides/${guideId}/bookings`, body, {
      locale,
      token,
      idempotencyKey,
    })
    return BookingSchema.parse(data)
  },

  /** Transport is NOT nested under a vehicle id — the vehicle goes in the body. */
  async createTransportBooking(
    token: string,
    locale: Locale,
    body: CreateTransportBookingBody,
    idempotencyKey: string,
  ): Promise<Booking> {
    const data = await api.post<unknown>('transportation/bookings', body, {
      locale,
      token,
      idempotencyKey,
    })
    return BookingSchema.parse(data)
  },
}

/** Absolute URL for the iCal download, which returns text/calendar not JSON. */
export function bookingIcalUrl(id: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3003'
  return `${base}/v1/bookings/${id}/ical`
}
