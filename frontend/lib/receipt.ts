import type { BookingDetail, Currency } from '@/types/api'
import type { PaymentProvider, PaymentReceipt, PaymentStatus } from '@/types/domain'

/**
 * Payment-receipt derivation (Task 12.5 — Requirement 6.9).
 *
 * The backend does not (yet) expose a dedicated receipt endpoint, so we derive
 * the receipt from the *confirmed* booking detail returned by
 * `GET /v1/bookings/:id`. This keeps the receipt anchored to real, server-owned
 * data (reference, amount, line items) rather than inventing payment figures.
 *
 * Assumptions (documented so they can be replaced once a `/receipt` endpoint
 * lands):
 * - `paidAt` is not present on `BookingDetail`; a confirmed booking implies the
 *   payment succeeded, but we cannot know the exact charge timestamp from this
 *   payload, so `paidAt` is derived best-effort and may be `null`.
 * - `provider` is not on `BookingDetail`. We default to `'stripe'` (card is the
 *   primary path) and let callers override when a specific provider is known.
 * - Line items mirror the booking's `items`; when none are present we synthesise
 *   a single total line so the receipt is never empty.
 */

/** Map a booking status to the receipt's payment status. */
export function paymentStatusForBooking(booking: BookingDetail): PaymentStatus {
  switch (booking.status) {
    case 'CONFIRMED':
    case 'COMPLETED':
      return 'succeeded'
    case 'CANCELLED':
    case 'EXPIRED':
      // A refund only applies if money actually moved; a non-zero refund amount
      // is the signal. Otherwise treat as failed/never-charged.
      return booking.refundAmountUsd != null && booking.refundAmountUsd > 0 ? 'refunded' : 'failed'
    case 'PENDING_PAYMENT':
    case 'HOLD':
    default:
      return 'pending'
  }
}

/** True when the booking has reached a state where a receipt is meaningful. */
export function bookingHasReceipt(booking: BookingDetail | null | undefined): boolean {
  if (!booking) return false
  const status = paymentStatusForBooking(booking)
  return status === 'succeeded' || status === 'refunded'
}

export interface DeriveReceiptOptions {
  /** Override the provider when the caller knows how the booking was paid. */
  provider?: PaymentProvider
  /** Display currency for the receipt header (amounts stay USD-based). */
  currency?: Currency
}

/**
 * Build a {@link PaymentReceipt} from a confirmed booking. Amounts remain in USD
 * (the canonical money unit); the UI converts to the display currency at render
 * time via `formatCurrency`, so we record the requested display currency only as
 * metadata.
 */
export function deriveReceipt(
  booking: BookingDetail,
  opts: DeriveReceiptOptions = {},
): PaymentReceipt {
  const lineItems =
    booking.items && booking.items.length > 0
      ? booking.items.map((item) => ({
          label: item.quantity && item.quantity > 1 ? `${item.name} × ${item.quantity}` : item.name,
          amountUsd: item.totalPriceUsd ?? (item.unitPriceUsd ?? 0) * (item.quantity ?? 1),
        }))
      : [{ label: booking.name, amountUsd: booking.totalPriceUsd }]

  return {
    id: booking.id,
    bookingReference: booking.reference,
    provider: opts.provider ?? 'stripe',
    status: paymentStatusForBooking(booking),
    amountUsd: booking.totalPriceUsd,
    currency: opts.currency ?? 'USD',
    // `BookingDetail` has no explicit payment timestamp; a cancelled booking's
    // `cancelledAt` is the closest known marker, otherwise unknown.
    paidAt: booking.cancelledAt ?? null,
    lineItems,
  }
}
