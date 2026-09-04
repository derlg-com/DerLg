import { z } from 'zod'

import { api } from './client'
import type { Locale } from '@/lib/i18n/config'

/**
 * Payments API.
 *
 * Split out from bookings because a payment is its own first-class resource with
 * dedicated backend endpoints (`/v1/payments/*`). Both calls are authenticated:
 * the backend scopes every payment to the JWT subject, so there is no
 * unauthenticated path here and the token is always required.
 *
 * The two responses use DIFFERENT casing on purpose, mirroring the backend:
 * starting a payment returns camelCase (`StartPaymentResult`), while the status
 * poll returns snake_case (a projection assembled for polling). Each schema
 * captures the shape as the API actually sends it rather than normalising one to
 * the other here — normalisation belongs at the point of use.
 */

/**
 * Methods the intent endpoint accepts.
 *
 * NOT the same set as the sandbox `bookings/:id/confirm` demo: there is no
 * `bakong_qr` here because the server has no Bakong implementation, so offering
 * it would let a customer pick a method that cannot take money.
 */
export const PAYMENT_INTENT_METHODS = ['card', 'aba_qr'] as const
export type PaymentIntentMethod = (typeof PAYMENT_INTENT_METHODS)[number]

/**
 * `POST /v1/payments/intents` → `StartPaymentResult`.
 *
 * `looseObject`: the payload is provider-shaped and may gain fields; an added one
 * must not break parsing. `clientSecret` is present only for card, and the `qr*`
 * fields only for ABA, so all four are optional — validating them as required
 * would reject the very response the other method legitimately returns.
 */
export const StartPaymentResultSchema = z.looseObject({
  paymentId: z.string(),
  bookingId: z.string(),
  bookingReference: z.string(),
  method: z.string(),
  amountUsd: z.number(),
  status: z.string(),
  clientSecret: z.string().nullish(),
  qrPayload: z.string().nullish(),
  qrImageDataUrl: z.string().nullish(),
  expiresAt: z.string().nullish(),
})

export type StartPaymentResult = z.infer<typeof StartPaymentResultSchema>

/**
 * `GET /v1/payments/status`.
 *
 * `looseObject` with `nullish` on everything but the id: a booking whose payment
 * has not started yet legitimately returns nulls for status/method/paid_at, and
 * the poll must tolerate that rather than reject a valid "nothing yet" response.
 * `status` is a plain string, never an enum, so an unrecognised value can be
 * treated as pending downstream instead of throwing — claiming a payment landed
 * when it did not is the one failure mode that must never happen.
 */
export const PaymentStatusResponseSchema = z.looseObject({
  booking_id: z.string(),
  booking_status: z.string().nullish(),
  payment_intent_id: z.string().nullish(),
  status: z.string().nullish(),
  amount_usd: z.number().nullish(),
  method: z.string().nullish(),
  paid_at: z.string().nullish(),
  qr_expires_at: z.string().nullish(),
})

export type PaymentStatusResponse = z.infer<typeof PaymentStatusResponseSchema>

export interface CreateIntentBody {
  bookingId: string
  method: PaymentIntentMethod
}

export const paymentsApi = {
  /**
   * Starts a payment and returns what the client needs to complete it: a Stripe
   * `clientSecret` for `card`, or a KHQR payload plus its PNG for `aba_qr`.
   */
  async createIntent(
    token: string,
    locale: Locale,
    body: CreateIntentBody,
  ): Promise<StartPaymentResult> {
    const data = await api.post<unknown>('payments/intents', body, { locale, token })
    return StartPaymentResultSchema.parse(data)
  },

  /**
   * Current payment state for one of the caller's bookings.
   *
   * Takes an `AbortSignal` so the poll can be cancelled on unmount instead of
   * resolving into a component that is no longer mounted.
   */
  async getStatus(
    token: string,
    locale: Locale,
    bookingId: string,
    signal?: AbortSignal,
  ): Promise<PaymentStatusResponse> {
    const data = await api.get<unknown>('payments/status', {
      locale,
      token,
      signal,
      query: { bookingId },
    })
    return PaymentStatusResponseSchema.parse(data)
  },
}
