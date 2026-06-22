import { api, ApiError } from './api-client'

export interface BookingResult {
  id: string
  reference?: string
  status?: string
  totalPriceUsd?: number
  holdExpiresAt?: string | null
}

/** Map a booking API error to a `bookings.form.*` i18n key. */
export function bookingErrorKey(
  err: unknown,
): 'errorUnavailable' | 'errorInvalidDates' | 'errorGeneric' {
  if (err instanceof ApiError) {
    if (err.status === 409) return 'errorUnavailable'
    if (err.status === 400) return 'errorInvalidDates'
  }
  return 'errorGeneric'
}

export function createTripBooking(
  tripId: string,
  body: { startDate: string; travelers: { adults: number; children?: number }; specialRequests?: string },
  idempotencyKey: string,
) {
  return api.post<BookingResult>(`/v1/trips/${tripId}/bookings`, body, { idempotencyKey })
}

export function createHotelBooking(
  hotelId: string,
  body: {
    roomId: string
    checkInDate: string
    checkOutDate: string
    guestsAdults: number
    guestsChildren?: number
    specialRequests?: string
  },
  idempotencyKey: string,
) {
  return api.post<BookingResult>(`/v1/hotels/${hotelId}/bookings`, body, { idempotencyKey })
}

export function createGuideBooking(
  guideId: string,
  body: { startDate: string; endDate: string; specialRequests?: string },
  idempotencyKey: string,
) {
  return api.post<BookingResult>(`/v1/guides/${guideId}/bookings`, body, { idempotencyKey })
}

export function createTransportBooking(
  body: {
    vehicleId: string
    startDate: string
    endDate: string
    pickupLocation: string
    dropoffLocation: string
    specialRequests?: string
  },
  idempotencyKey: string,
) {
  return api.post<BookingResult>('/v1/transportation/bookings', body, { idempotencyKey })
}

export interface CancelResult {
  refundAmountUsd: number
  refundPercentage: number
  refundMethod: string | null
}

export function cancelBooking(id: string, reason?: string) {
  return api.post<CancelResult>(`/v1/bookings/${id}/cancel`, { reason: reason || undefined })
}

export function fetchBookingQr(id: string) {
  return api.get<{ qrCodeUrl: string }>(`/v1/bookings/${id}/qr`)
}

/** Fetch the iCalendar file as text (auth required, so cannot be a plain link). */
export function fetchIcal(id: string) {
  return api.get<string>(`/v1/bookings/${id}/ical`)
}
