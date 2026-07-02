import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { useLanguageStore } from '@/lib/i18n'

// Task 15.2 — EmergencyAlertModal flow: type selection, location capture,
// 5-second countdown with cancel, send on completion, and a confirmation screen
// showing emergency contacts (Requirements 10.4, 10.5, 10.7, 10.8).

const sendEmergencyAlert = vi.fn()
const fetchEmergencyContacts = vi.fn()

vi.mock('@/lib/emergency-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/emergency-api')>('@/lib/emergency-api')
  return {
    ...actual,
    sendEmergencyAlert: (...args: unknown[]) => sendEmergencyAlert(...args),
    fetchEmergencyContacts: (...args: unknown[]) => fetchEmergencyContacts(...args),
  }
})

import { EmergencyAlertModal } from '@/components/emergency/EmergencyAlertModal'

function grantGeolocation() {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (
        success: (p: { coords: { latitude: number; longitude: number; accuracy: number } }) => void,
      ) => success({ coords: { latitude: 11.5564, longitude: 104.9282, accuracy: 10 } }),
    },
  })
}

describe('EmergencyAlertModal (Task 15.2)', () => {
  beforeEach(() => {
    useLanguageStore.setState({ locale: 'en' })
    sendEmergencyAlert.mockReset().mockResolvedValue({ id: 'alert-1', status: 'triggered' })
    fetchEmergencyContacts.mockReset().mockResolvedValue(null)
    grantGeolocation()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('captures location and enables sending', async () => {
    render(<EmergencyAlertModal open onOpenChange={() => {}} bookingId="bk-1" />)
    await waitFor(() => expect(screen.getByTestId('emergency-send')).not.toBeDisabled())
  })

  it('sends the alert after the countdown completes, then shows contacts (Req 10.4/10.5/10.8)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<EmergencyAlertModal open onOpenChange={() => {}} bookingId="bk-42" />)

    await waitFor(() => expect(screen.getByTestId('emergency-send')).not.toBeDisabled())

    // Choose a non-default alert type.
    fireEvent.click(screen.getByTestId('alert-type-medical'))
    fireEvent.click(screen.getByTestId('emergency-send'))

    // Countdown banner appears.
    expect(screen.getByTestId('emergency-countdown')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(5000)
    })

    await waitFor(() => expect(sendEmergencyAlert).toHaveBeenCalledTimes(1))
    expect(sendEmergencyAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        alertType: 'medical',
        latitude: 11.5564,
        longitude: 104.9282,
        bookingId: 'bk-42',
      }),
    )

    // Confirmation screen shows emergency contacts (Cambodia static fallback).
    await waitFor(() => expect(screen.getByText('Alert sent')).toBeInTheDocument())
    expect(screen.getByText('117')).toBeInTheDocument()
    expect(screen.getByText('119')).toBeInTheDocument()
  })

  it('cancelling the countdown does NOT send the alert (Req 10.8)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<EmergencyAlertModal open onOpenChange={() => {}} bookingId="bk-9" />)

    await waitFor(() => expect(screen.getByTestId('emergency-send')).not.toBeDisabled())
    fireEvent.click(screen.getByTestId('emergency-send'))

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    fireEvent.click(screen.getByTestId('emergency-cancel'))

    await act(async () => {
      vi.advanceTimersByTime(10000)
    })

    expect(sendEmergencyAlert).not.toHaveBeenCalled()
    // Back to the selection footer.
    expect(screen.getByTestId('emergency-send')).toBeInTheDocument()
  })

  it('still shows emergency contacts when sending fails (graceful degradation, Req 10.5)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    sendEmergencyAlert.mockRejectedValue(new Error('no backend'))
    render(<EmergencyAlertModal open onOpenChange={() => {}} bookingId="bk-err" />)

    await waitFor(() => expect(screen.getByTestId('emergency-send')).not.toBeDisabled())
    fireEvent.click(screen.getByTestId('emergency-send'))

    await act(async () => {
      vi.advanceTimersByTime(5000)
    })

    await waitFor(() => expect(screen.getByText("Couldn't send alert")).toBeInTheDocument())
    expect(screen.getByText('117')).toBeInTheDocument()
  })

  it('offers manual entry when geolocation permission is denied (Req 10.6)', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (
          _s: unknown,
          error: (e: { code: number; PERMISSION_DENIED: number; TIMEOUT: number }) => void,
        ) => error({ code: 1, PERMISSION_DENIED: 1, TIMEOUT: 3 }),
      },
    })
    render(<EmergencyAlertModal open onOpenChange={() => {}} bookingId="bk-m" />)

    await waitFor(() => expect(screen.getByTestId('manual-entry')).toBeInTheDocument())
    // Send is disabled until manual coords are committed.
    expect(screen.getByTestId('emergency-send')).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '13.36' } })
    fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: '103.84' } })
    fireEvent.click(screen.getByText('Use this location'))

    await waitFor(() => expect(screen.getByTestId('emergency-send')).not.toBeDisabled())
  })
})
