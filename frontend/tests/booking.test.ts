import { describe, it, expect } from 'vitest'
import {
  tripBookingSchema,
  hotelBookingSchema,
  guideBookingSchema,
  transportBookingSchema,
} from '@/schemas/booking'
import { bookingErrorKey } from '@/lib/bookings-api'
import { ApiError } from '@/lib/api-client'

describe('booking schemas', () => {
  it('trip requires at least one adult', () => {
    expect(
      tripBookingSchema.safeParse({ startDate: '2026-07-01', adults: 2, children: 0, specialRequests: '' })
        .success,
    ).toBe(true)
    expect(
      tripBookingSchema.safeParse({ startDate: '2026-07-01', adults: 0, children: 0, specialRequests: '' })
        .success,
    ).toBe(false)
  })

  it('hotel requires check-out after check-in', () => {
    expect(
      hotelBookingSchema.safeParse({
        checkInDate: '2026-07-01',
        checkOutDate: '2026-07-03',
        guestsAdults: 1,
        guestsChildren: 0,
        specialRequests: '',
      }).success,
    ).toBe(true)
    expect(
      hotelBookingSchema.safeParse({
        checkInDate: '2026-07-03',
        checkOutDate: '2026-07-01',
        guestsAdults: 1,
        guestsChildren: 0,
        specialRequests: '',
      }).success,
    ).toBe(false)
  })

  it('guide requires end on or after start', () => {
    expect(
      guideBookingSchema.safeParse({ startDate: '2026-07-01', endDate: '2026-07-01', specialRequests: '' })
        .success,
    ).toBe(true)
    expect(
      guideBookingSchema.safeParse({ startDate: '2026-07-05', endDate: '2026-07-01', specialRequests: '' })
        .success,
    ).toBe(false)
  })

  it('transport requires pickup and dropoff', () => {
    expect(
      transportBookingSchema.safeParse({
        startDate: '2026-07-01',
        endDate: '2026-07-02',
        pickupLocation: 'Airport',
        dropoffLocation: 'Hotel',
        specialRequests: '',
      }).success,
    ).toBe(true)
    expect(
      transportBookingSchema.safeParse({
        startDate: '2026-07-01',
        endDate: '2026-07-02',
        pickupLocation: '',
        dropoffLocation: 'Hotel',
        specialRequests: '',
      }).success,
    ).toBe(false)
  })
})

describe('bookingErrorKey', () => {
  it('maps 409 -> unavailable, 400 -> invalidDates, else generic', () => {
    expect(bookingErrorKey(new ApiError({ code: 'BKNG_UNAVAILABLE', message: 'x', status: 409 }))).toBe(
      'errorUnavailable',
    )
    expect(bookingErrorKey(new ApiError({ code: 'BKNG_INVALID', message: 'x', status: 400 }))).toBe(
      'errorInvalidDates',
    )
    expect(bookingErrorKey(new Error('x'))).toBe('errorGeneric')
  })
})
