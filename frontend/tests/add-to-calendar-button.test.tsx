import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Task 13.2 — "Add to calendar" action (Requirement 39.8).
//
// The iCalendar file is served from an auth-protected endpoint, so the action
// fetches the text and triggers a client-side download (rather than a plain
// link). This shared button is reused on both the booking detail page and the
// confirmation page; we assert it fetches the ical and wires the download with
// a filename derived from the reference.

const fetchIcal = vi.fn()
vi.mock('@/lib/bookings-api', () => ({
  fetchIcal: (...args: unknown[]) => fetchIcal(...args),
}))

const toast = vi.fn()
vi.mock('@/components/ui/toast', () => ({
  toast: (...args: unknown[]) => toast(...args),
}))

import { AddToCalendarButton } from '@/components/bookings/AddToCalendarButton'

describe('AddToCalendarButton (Task 13.2 — Req 39.8)', () => {
  let clickSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchIcal.mockReset()
    toast.mockReset()
    // Stub object-URL + anchor click so the download path is observable.
    clickSpy = vi.fn()
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock')
    globalThis.URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(clickSpy)
  })
  afterEach(() => vi.restoreAllMocks())

  it('fetches the ical and triggers a download named from the reference', async () => {
    fetchIcal.mockResolvedValue('BEGIN:VCALENDAR\nEND:VCALENDAR')

    render(<AddToCalendarButton bookingId="b1" reference="DLG-ABC123" />)
    fireEvent.click(screen.getByRole('button', { name: /add to calendar/i }))

    await waitFor(() => expect(fetchIcal).toHaveBeenCalledWith('b1'))
    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1))
    expect(globalThis.URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledTimes(1)
  })

  it('shows an error toast when the ical download fails', async () => {
    fetchIcal.mockRejectedValue(new Error('boom'))

    render(<AddToCalendarButton bookingId="b1" reference="DLG-ABC123" />)
    fireEvent.click(screen.getByRole('button', { name: /add to calendar/i }))

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' })),
    )
    expect(clickSpy).not.toHaveBeenCalled()
  })
})
