'use client'

import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'

import { useAccessToken } from '@/hooks/use-auth'
import { ApiError } from '@/lib/api/errors'
import { paymentsApi, type PaymentStatusResponse } from '@/lib/api/payments'
import type { Locale } from '@/lib/i18n/config'

/**
 * Watches a booking's payment until it settles.
 *
 * The confirmation must appear on its own once the provider confirms — the
 * browser is never trusted to declare a payment done. A card can settle by
 * webhook after the page has moved on, and ABA settles out-of-band from a
 * Telegram credit alert, so neither outcome is knowable from the request that
 * started the payment. Polling the backend closes that loop without inventing a
 * socket event.
 *
 * The backend stays the authority on what the payment MEANS: this only reads
 * status. It cannot create, capture or confirm anything, so a compromised client
 * learns nothing it did not already have (it already holds the booking id).
 *
 * Polling stops the moment the status is terminal, so a settled payment costs no
 * further requests.
 */

/** Kept as the module's public name; the shape now lives in `lib/api/payments`. */
export type RawPaymentStatus = PaymentStatusResponse

export type PaymentState = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED'

export interface PaymentSnapshot {
  bookingId: string
  state: PaymentState
  bookingStatus?: string
  paymentIntentId?: string
  amountUsd?: number
  method?: string
  paidAt?: string
  /** ABA only: when the KHQR the customer is scanning stops being accepted. */
  qrExpiresAt?: string
  /** No further change is possible; polling has stopped. */
  settled: boolean
}

/**
 * Normalises the backend's payment vocabulary.
 *
 * The backend stores lowercase Prisma enum values (`succeeded`, `failed`, ...).
 * Anything unrecognised is treated as PENDING rather than guessed as success —
 * claiming a payment landed when it did not is the one failure mode that must not
 * happen.
 */
export function toPaymentState(raw: string | null | undefined): PaymentState {
  const value = (raw ?? '').toLowerCase()
  if (value === 'succeeded' || value === 'success' || value === 'paid') return 'SUCCEEDED'
  if (value === 'failed' || value === 'failure' || value === 'error') return 'FAILED'
  if (value === 'cancelled' || value === 'canceled' || value === 'expired') return 'CANCELLED'
  return 'PENDING'
}

const POLL_INTERVAL_MS = 5_000
/** ~5 minutes. A hold lives 15, but an unpaid QR does not need a 15-minute poll. */
const MAX_POLLS = 60

export interface UsePaymentStatusOptions {
  bookingId: string | undefined
  /** Set false to stop polling (expired code, settled elsewhere, panel closed). */
  enabled?: boolean
}

/**
 * `GET /v1/payments/status` is user-scoped: the backend derives the owner from the
 * JWT subject and returns a booking's amount, method and paid-at timestamp. So the
 * token is REQUIRED — without it every poll 401s — and a guest session must not
 * poll at all rather than hammer a route it cannot use.
 */
export function usePaymentStatus({ bookingId, enabled = true }: UsePaymentStatusOptions) {
  const locale = useLocale() as Locale
  const token = useAccessToken()

  const query = useQuery({
    queryKey: ['payment-status', locale, bookingId],
    queryFn: async ({ signal }): Promise<PaymentSnapshot> => {
      const data = await paymentsApi.getStatus(token!, locale, bookingId!, signal)
      const state = toPaymentState(data.status)

      return {
        bookingId: data.booking_id,
        state,
        settled: state !== 'PENDING',
        bookingStatus: data.booking_status ?? undefined,
        paymentIntentId: data.payment_intent_id ?? undefined,
        amountUsd: data.amount_usd ?? undefined,
        method: data.method ?? undefined,
        paidAt: data.paid_at ?? undefined,
        qrExpiresAt: data.qr_expires_at ?? undefined,
      }
    },
    enabled: enabled && Boolean(bookingId) && Boolean(token),
    // A payment is inherently volatile; a cached "pending" is worse than a refetch.
    staleTime: 0,
    gcTime: 60_000,
    refetchInterval: (q) => {
      if (q.state.data?.settled) return false
      /*
       * A rejection or a missing booking will not fix itself by asking again, and
       * polling through it would fire ~60 doomed requests. Retrying a transient
       * network blip is still worthwhile, so only terminal statuses stop the loop.
       */
      if (isTerminalError(q.state.error)) return false
      // Give up rather than poll a stuck payment forever; the user can still ask.
      if (q.state.dataUpdateCount + q.state.errorUpdateCount >= MAX_POLLS) return false
      return POLL_INTERVAL_MS
    },
    // Nothing changes while the tab is hidden that the next focus won't pick up.
    refetchIntervalInBackground: false,
    retry: (failureCount, error) => !isTerminalError(error) && failureCount < 1,
  })

  return query
}

/** 401/403/404 will not resolve by retrying; anything else might. */
function isTerminalError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false
  return error.status === 401 || error.status === 403 || error.status === 404
}
