'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'

import { useAccessToken } from '@/hooks/use-auth'
import {
  paymentsApi,
  type PaymentIntentMethod,
  type StartPaymentResult,
} from '@/lib/api/payments'
import type { Locale } from '@/lib/i18n/config'

/**
 * Payment mutation hooks.
 *
 * Watching a payment settle lives in `use-payment-status.ts` (it polls); this
 * file owns the one write — starting a payment. Like bookings, it is scoped by
 * token rather than locale: a payment is the user's own money-moving record, and
 * a Stripe `clientSecret` must never survive a sign-out into another session.
 */

export interface StartPaymentInput {
  bookingId: string
  method: PaymentIntentMethod
}

/**
 * Starts a payment for a booking.
 *
 * Returns the `StartPaymentResult` so the caller can branch on `method`: render
 * the Stripe card form off `clientSecret`, or the ABA panel off `qrImageDataUrl`.
 *
 * It deliberately does NOT poll or confirm. Settlement is observed separately by
 * `usePaymentStatus`, because neither a Stripe webhook nor an ABA credit alert is
 * knowable from the response that starts the payment — trusting the browser to
 * declare success is exactly the failure mode the split avoids.
 *
 * No idempotency key is sent: the backend derives its own from the booking id and
 * amount, so a double-tap reuses the existing intent instead of minting a second
 * one that could be confirmed for a second charge.
 */
export function useStartPayment() {
  const token = useAccessToken()
  const locale = useLocale() as Locale
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: StartPaymentInput): Promise<StartPaymentResult> => {
      if (!token) throw new Error('not authenticated')
      return paymentsApi.createIntent(token, locale, input)
    },
    onSuccess: () => {
      /*
       * Starting a payment flips the booking hold → pending_payment server-side,
       * so the cached booking is now stale. Invalidate it rather than leave a
       * "Pay" affordance pointing at a status the server has already moved past.
       */
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    },
  })
}
