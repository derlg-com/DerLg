import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useLanguageStore } from '@/lib/i18n'
import { EmergencyAlertButton } from '@/components/emergency/EmergencyAlertButton'

// Task 14.5 — Emergency Alert button entry point on the booking detail (Req 7.6, 10.1).
//
// The button must surface only for active bookings within 24h of start, and its
// click must hand off to the alert flow (Section 15) via onActivate. Until then,
// the placeholder handler keeps the entry point non-broken.

const NOW = Date.parse('2026-12-01T12:00:00Z')
const HOUR = 60 * 60 * 1000

function iso(msFromNow: number): string {
  return new Date(NOW + msFromNow).toISOString()
}

describe('EmergencyAlertButton (Task 14.5)', () => {
  beforeEach(() => {
    useLanguageStore.setState({ locale: 'en' })
  })
  afterEach(() => vi.clearAllMocks())

  it('renders for an active booking within 24h of start (Req 7.6)', () => {
    render(
      <EmergencyAlertButton
        bookingId="bk-1"
        startDate={iso(6 * HOUR)}
        status="CONFIRMED"
        now={NOW}
      />,
    )
    expect(screen.getByTestId('emergency-alert-button')).toBeInTheDocument()
    expect(screen.getByText('Emergency Alert')).toBeInTheDocument()
  })

  it('does not render when the start is more than 24h away', () => {
    render(
      <EmergencyAlertButton
        bookingId="bk-1"
        startDate={iso(48 * HOUR)}
        status="CONFIRMED"
        now={NOW}
      />,
    )
    expect(screen.queryByTestId('emergency-alert-button')).not.toBeInTheDocument()
  })

  it('does not render for a cancelled booking inside the time window', () => {
    render(
      <EmergencyAlertButton
        bookingId="bk-1"
        startDate={iso(6 * HOUR)}
        status="CANCELLED"
        now={NOW}
      />,
    )
    expect(screen.queryByTestId('emergency-alert-button')).not.toBeInTheDocument()
  })

  it('invokes onActivate with the booking id when clicked (entry point for Section 15)', () => {
    const onActivate = vi.fn()
    render(
      <EmergencyAlertButton
        bookingId="bk-42"
        startDate={iso(2 * HOUR)}
        status="CONFIRMED"
        now={NOW}
        onActivate={onActivate}
      />,
    )
    fireEvent.click(screen.getByTestId('emergency-alert-button'))
    expect(onActivate).toHaveBeenCalledWith('bk-42')
  })
})
