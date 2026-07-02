import { describe, it, expect } from 'vitest'
import {
  tripBookingSchema,
  hotelBookingSchema,
  guideBookingSchema,
  transportBookingSchema,
  createTripBookingSchema,
  isFutureOrToday,
  dateOnly,
  todayIso,
} from '@/schemas/booking'
import { bookingErrorKey } from '@/lib/bookings-api'
import { ApiError } from '@/lib/api-client'

describe('booking schemas', () => {
  it('trip requires at least one adult', () => {
    expect(
      tripBookingSchema.safeParse({
        startDate: '2026-07-01',
        adults: 2,
        children: 0,
        specialRequests: '',
      }).success,
    ).toBe(true)
    expect(
      tripBookingSchema.safeParse({
        startDate: '2026-07-01',
        adults: 0,
        children: 0,
        specialRequests: '',
      }).success,
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
      guideBookingSchema.safeParse({
        startDate: '2026-07-01',
        endDate: '2026-07-01',
        specialRequests: '',
      }).success,
    ).toBe(true)
    expect(
      guideBookingSchema.safeParse({
        startDate: '2026-07-05',
        endDate: '2026-07-01',
        specialRequests: '',
      }).success,
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

describe('booking date helpers', () => {
  it('dateOnly normalizes and rejects bad input', () => {
    expect(dateOnly('2026-07-01')).toBe('2026-07-01')
    expect(dateOnly('  2026-07-01  ')).toBe('2026-07-01')
    expect(dateOnly('')).toBeNull()
    expect(dateOnly('not-a-date')).toBeNull()
  })

  it('isFutureOrToday accepts today and future, rejects past', () => {
    expect(isFutureOrToday('2026-07-02', '2026-07-01')).toBe(true)
    expect(isFutureOrToday('2026-07-01', '2026-07-01')).toBe(true)
    expect(isFutureOrToday('2026-06-30', '2026-07-01')).toBe(false)
    expect(isFutureOrToday('', '2026-07-01')).toBe(false)
  })

  it('todayIso returns a YYYY-MM-DD string for a given date', () => {
    expect(todayIso(new Date(2026, 6, 5))).toBe('2026-07-05')
    expect(todayIso(new Date(2026, 0, 9))).toBe('2026-01-09')
  })
})

describe('createTripBookingSchema (form rules)', () => {
  const today = '2026-07-01'

  it('rejects start dates before today with errorPastDate', () => {
    const schema = createTripBookingSchema({ today, maxGuests: 10 })
    const res = schema.safeParse({
      startDate: '2026-06-30',
      adults: 1,
      children: 0,
      specialRequests: '',
    })
    expect(res.success).toBe(false)
    if (!res.success) {
      const issue = res.error.issues.find((i) => i.path[0] === 'startDate')
      expect(issue?.message).toBe('errorPastDate')
    }
  })

  it('accepts a future start date within capacity', () => {
    const schema = createTripBookingSchema({ today, maxGuests: 10 })
    expect(
      schema.safeParse({ startDate: '2026-07-10', adults: 2, children: 1, specialRequests: '' })
        .success,
    ).toBe(true)
  })

  it('rejects total travelers exceeding maxGuests with errorExceedsCapacity', () => {
    const schema = createTripBookingSchema({ today, maxGuests: 4 })
    const res = schema.safeParse({
      startDate: '2026-07-10',
      adults: 3,
      children: 2,
      specialRequests: '',
    })
    expect(res.success).toBe(false)
    if (!res.success) {
      const issue = res.error.issues.find((i) => i.path[0] === 'adults')
      expect(issue?.message).toBe('errorExceedsCapacity')
    }
  })

  it('allows travelers up to the exact capacity', () => {
    const schema = createTripBookingSchema({ today, maxGuests: 4 })
    expect(
      schema.safeParse({ startDate: '2026-07-10', adults: 3, children: 1, specialRequests: '' })
        .success,
    ).toBe(true)
  })

  it('skips capacity check when maxGuests is null or non-positive', () => {
    const unlimited = createTripBookingSchema({ today, maxGuests: null })
    expect(
      unlimited.safeParse({ startDate: '2026-07-10', adults: 40, children: 5, specialRequests: '' })
        .success,
    ).toBe(true)
    const zeroCap = createTripBookingSchema({ today, maxGuests: 0 })
    expect(
      zeroCap.safeParse({ startDate: '2026-07-10', adults: 5, children: 0, specialRequests: '' })
        .success,
    ).toBe(true)
  })
})

describe('bookingErrorKey', () => {
  it('maps 409 -> unavailable, 400 -> invalidDates, else generic', () => {
    expect(
      bookingErrorKey(new ApiError({ code: 'BKNG_UNAVAILABLE', message: 'x', status: 409 })),
    ).toBe('errorUnavailable')
    expect(bookingErrorKey(new ApiError({ code: 'BKNG_INVALID', message: 'x', status: 400 }))).toBe(
      'errorInvalidDates',
    )
    expect(bookingErrorKey(new Error('x'))).toBe('errorGeneric')
  })
})
