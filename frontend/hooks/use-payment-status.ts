'use client'

import { useEffect, useRef, useState } from 'react'
import { getPaymentProvider, type PaymentMethod, type PaymentStatus } from '@/lib/payments'

/** Default interval (ms) between QR status polls (Requirement 6.8). */
export const PAYMENT_POLL_INTERVAL_MS = 3000

export interface PaymentStatusState {
  status: PaymentStatus | 'idle'
  reference: string | null
  /** Last polling error message, if any (transient — polling continues). */
  error: string | null
}

interface UsePaymentStatusOptions {
  /** Only poll while enabled (e.g. for QR methods and before expiry). */
  enabled: boolean
  bookingId: string
  method: PaymentMethod
  /** Poll cadence in ms. Defaults to {@link PAYMENT_POLL_INTERVAL_MS}. */
  intervalMs?: number
  /** Called once when the payment reaches a `paid` terminal state. */
  onPaid?: (reference: string) => void
}

/**
 * Poll backend payment status for QR payments until a terminal state
 * (`paid` / `failed` / `expired`) is reached (Requirement 6.8 — real-time
 * status updates for QR payments). Polling stops on any terminal state, when
 * disabled, or on unmount. Transient poll errors are surfaced but do not stop
 * polling, so a flaky network self-heals.
 */
export function usePaymentStatus({
  enabled,
  bookingId,
  method,
  intervalMs = PAYMENT_POLL_INTERVAL_MS,
  onPaid,
}: UsePaymentStatusOptions): PaymentStatusState {
  const [state, setState] = useState<PaymentStatusState>({
    status: 'idle',
    reference: null,
    error: null,
  })
  // Keep the latest onPaid without retriggering the polling effect.
  const onPaidRef = useRef(onPaid)
  onPaidRef.current = onPaid

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const provider = getPaymentProvider()

    const isTerminal = (s: PaymentStatus): boolean =>
      s === 'paid' || s === 'failed' || s === 'expired'

    const poll = async () => {
      try {
        const result = await provider.getStatus({ bookingId, method })
        if (cancelled) return
        setState({ status: result.status, reference: result.reference, error: null })
        if (result.status === 'paid') {
          onPaidRef.current?.(result.reference)
        }
        if (isTerminal(result.status)) return // stop polling on terminal state
      } catch (err) {
        if (cancelled) return
        // Transient: surface the error but keep polling.
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'status_error',
        }))
      }
      if (!cancelled) timer = setTimeout(poll, intervalMs)
    }

    void poll()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [enabled, bookingId, method, intervalMs])

  return state
}
