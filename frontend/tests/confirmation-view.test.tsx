import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ApiError } from '@/lib/api-client'
import type { ApiQueryResult } from '@/lib/use-api-query'
import type { BookingDetail } from '@/types/api'

// Task 13.1 — Booking confirmation page (Requirements 39.1, 39.2, 39.5, 7.9).
// Task 13.2 — Confirmation actions (Requirements 39.4, 39.6, 39.8, 39.9).
//
// The confirmation page must:
//  - show a loading state while the booking loads,
//  - show the success confirmation (title + reference) and a key booking
//    details summary (name + dates) once the booking is CONFIRMED,
//  - gracefully handle a missing booking (404) instead of faking success,
//  - guide the user back to checkout when the booking is not yet confirmed
//    (HOLD / PENDING_PAYMENT),
//  - offer confirmation actions: add to calendar (39.8), download confirmation
//    PDF (39.4), share, and next-steps / preparation guidance (39.9). The
//    receipt + receipt-PDF download (39.6) come from the PaymentReceipt
//    sub-component (Task 12.5).
//
// The confirmation email (39.3) is sent server-side at booking-confirm time;
// there is no frontend endpoint to call, so it is not a frontend action here.
// Support contact info (39.7) is Task 13.3; the check-in QR lives on the linked
// booking detail page (Task 14.4).

const useApiQuery = vi.fn()
vi.mock('@/lib/use-api-query', () => ({
  useApiQuery: (...args: unknown[]) => useApiQuery(...args),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => '/checkout/b1/confirmation',
}))

// The receipt sub-component is exercised by its own task (12.5); stub it so this
// suite focuses on the confirmation page's structure and state handling.
vi.mock('@/components/checkout/PaymentReceipt', () => ({
  PaymentReceipt: () => <div data-testid="receipt" />,
}))

// The calendar action fetches an auth-protected ical; stub the network call.
const fetchIcal = vi.fn(() => Promise.resolve('BEGIN:VCALENDAR\nEND:VCALENDAR'))
vi.mock('@/lib/bookings-api', () => ({
  fetchIcal: (...args: unknown[]) => fetchIcal(...args),
}))

import { ConfirmationView } from '@/components/checkout/ConfirmationView'
import { useAuthStore } from '@/stores/auth.store'

function confirmedBooking(overrides: Partial<BookingDetail> = {}): BookingDetail {
  return {
    id: 'b1',
    reference: 'DLG-ABC123',
    type: 'trip',
    name: 'Angkor Sunrise Tour',
    startDate: '2030-01-10',
    endDate: '2030-01-12',
    status: 'CONFIRMED',
    totalPriceUsd: 120,
    coverImageUrl: null,
    ...overrides,
  }
}

function loading<T>(): ApiQueryResult<T> {
  return { data: null, error: null, isLoading: true, refetch: vi.fn() }
}
function ok<T>(data: T): ApiQueryResult<T> {
  return { data, error: null, isLoading: false, refetch: vi.fn() }
}
function notFound<T>(): ApiQueryResult<T> {
  return {
    data: null,
    error: new ApiError({ code: 'NOT_FOUND', message: 'not found', status: 404 }),
    isLoading: false,
    refetch: vi.fn(),
  }
}

describe('ConfirmationView (Task 13.1)', () => {
  beforeEach(() => {
    useApiQuery.mockReset()
    // Drive the shared auth gate (BookingShell) to an authenticated, rehydrated
    // state so the protected subtree renders.
    useAuthStore.getState().setSession('token', {
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
      role: 'user',
    })
    useAuthStore.getState().setRehydrated(true)
  })
  afterEach(() => {
    useAuthStore.getState().clearSession()
    vi.clearAllMocks()
  })

  it('shows a loading state while the booking loads', () => {
    useApiQuery.mockReturnValue(loading())
    render(<ConfirmationView bookingId="b1" />)
    expect(screen.getByText('Loading your confirmation…')).toBeInTheDocument()
    expect(screen.queryByText('Booking confirmed!')).not.toBeInTheDocument()
  })

  it('shows success, reference and the booking summary when confirmed', () => {
    useApiQuery.mockReturnValue(ok(confirmedBooking()))
    render(<ConfirmationView bookingId="b1" />)
    expect(screen.getByRole('heading', { name: 'Booking confirmed!' })).toBeInTheDocument()
    expect(screen.getByText('DLG-ABC123')).toBeInTheDocument()
    expect(screen.getByText('Angkor Sunrise Tour')).toBeInTheDocument()
    // View booking links to the booking detail page (where the check-in QR lives).
    expect(screen.getByRole('link', { name: 'View booking' })).toHaveAttribute(
      'href',
      '/bookings/b1',
    )
  })

  it('shows a not-found state instead of success when the booking is missing', () => {
    useApiQuery.mockReturnValue(notFound())
    render(<ConfirmationView bookingId="missing" />)
    expect(screen.getByText('Booking not found')).toBeInTheDocument()
    expect(screen.queryByText('Booking confirmed!')).not.toBeInTheDocument()
  })

  it('guides the user back to checkout when the booking is not yet confirmed', () => {
    useApiQuery.mockReturnValue(ok(confirmedBooking({ status: 'PENDING_PAYMENT' })))
    render(<ConfirmationView bookingId="b1" />)
    expect(screen.getByText('Payment not completed yet')).toBeInTheDocument()
    expect(screen.queryByText('Booking confirmed!')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Complete payment' })).toHaveAttribute(
      'href',
      '/checkout/b1',
    )
  })

  it('renders confirmation actions and next steps when confirmed (Task 13.2)', () => {
    useApiQuery.mockReturnValue(ok(confirmedBooking()))
    render(<ConfirmationView bookingId="b1" />)

    // 39.8 add-to-calendar, 39.4 download confirmation, share.
    expect(screen.getByRole('button', { name: /add to calendar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /download confirmation/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /share booking/i })).toBeInTheDocument()

    // 39.9 next steps / preparation instructions (trip-specific tip shown).
    expect(screen.getByTestId('next-steps')).toBeInTheDocument()
    expect(screen.getByText('Next steps')).toBeInTheDocument()
    expect(screen.getByText('Arrive at the meeting point 15 minutes early.')).toBeInTheDocument()
  })

  it('downloads the confirmation via the browser print-to-PDF (Req 39.4)', () => {
    const printSpy = vi.fn()
    Object.defineProperty(window, 'print', {
      writable: true,
      configurable: true,
      value: printSpy,
    })
    useApiQuery.mockReturnValue(ok(confirmedBooking()))
    render(<ConfirmationView bookingId="b1" />)

    fireEvent.click(screen.getByRole('button', { name: /download confirmation/i }))
    expect(printSpy).toHaveBeenCalledTimes(1)
  })
})
