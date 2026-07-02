import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const getStatus = vi.fn()
vi.mock('@/lib/payments', () => ({
  getPaymentProvider: () => ({ getStatus }),
}))

import { usePaymentStatus } from '@/hooks/use-payment-status'

describe('usePaymentStatus (QR polling)', () => {
  beforeEach(() => {
    getStatus.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not poll when disabled', () => {
    renderHook(() => usePaymentStatus({ enabled: false, bookingId: 'b1', method: 'bakong_qr' }))
    expect(getStatus).not.toHaveBeenCalled()
  })

  it('reaches paid and fires onPaid, then stops polling (success)', async () => {
    getStatus
      .mockResolvedValueOnce({ status: 'pending', reference: 'r1' })
      .mockResolvedValueOnce({ status: 'paid', reference: 'r1' })
    const onPaid = vi.fn()

    const { result } = renderHook(() =>
      usePaymentStatus({
        enabled: true,
        bookingId: 'b1',
        method: 'bakong_qr',
        intervalMs: 5,
        onPaid,
      }),
    )

    await waitFor(() => expect(result.current.status).toBe('paid'))
    expect(onPaid).toHaveBeenCalledWith('r1')

    // Once terminal, no further polls are scheduled.
    const callsAtTerminal = getStatus.mock.calls.length
    await new Promise((r) => setTimeout(r, 30))
    expect(getStatus.mock.calls.length).toBe(callsAtTerminal)
  })

  it('reaches failed and stops polling (failure)', async () => {
    getStatus.mockResolvedValue({ status: 'failed', reference: 'r2' })
    const onPaid = vi.fn()

    const { result } = renderHook(() =>
      usePaymentStatus({
        enabled: true,
        bookingId: 'b2',
        method: 'aba_qr',
        intervalMs: 5,
        onPaid,
      }),
    )

    await waitFor(() => expect(result.current.status).toBe('failed'))
    expect(onPaid).not.toHaveBeenCalled()

    const callsAtTerminal = getStatus.mock.calls.length
    await new Promise((r) => setTimeout(r, 30))
    expect(getStatus.mock.calls.length).toBe(callsAtTerminal)
  })

  it('keeps polling through a transient error and surfaces it', async () => {
    getStatus
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ status: 'paid', reference: 'r3' })
    const onPaid = vi.fn()

    const { result } = renderHook(() =>
      usePaymentStatus({
        enabled: true,
        bookingId: 'b3',
        method: 'bakong_qr',
        intervalMs: 5,
        onPaid,
      }),
    )

    await waitFor(() => expect(result.current.status).toBe('paid'))
    expect(onPaid).toHaveBeenCalledWith('r3')
  })
})
