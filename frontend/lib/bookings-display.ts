import type { BookingStatus } from '@/types/api'

export type BookingGroup = 'upcoming' | 'past' | 'cancelled'

/** Group a raw booking status into the My Trips tabs. */
export function bookingGroup(status: BookingStatus | string): BookingGroup {
  if (status === 'CANCELLED') return 'cancelled'
  if (status === 'COMPLETED' || status === 'EXPIRED') return 'past'
  return 'upcoming' // CONFIRMED, PENDING_PAYMENT, HOLD
}

export type StatusBadgeVariant =
  'default' | 'secondary' | 'outline' | 'muted' | 'success' | 'warning' | 'destructive'

export function statusVariant(status: BookingStatus | string): StatusBadgeVariant {
  switch (status) {
    case 'CONFIRMED':
      return 'success'
    case 'COMPLETED':
      return 'secondary'
    case 'CANCELLED':
      return 'destructive'
    case 'PENDING_PAYMENT':
    case 'HOLD':
      return 'warning'
    default:
      return 'muted'
  }
}

export interface RefundTier {
  percentage: number
  daysUntil: number
}

/**
 * Tiered refund preview (matches backend policy):
 *  - ≥ 7 days before start → 100%
 *  - 1–7 days before start → 50%
 *  - < 24 hours before start → 0%
 */
export function refundTier(startDate: string, now: number = Date.now()): RefundTier {
  const start = new Date(startDate).getTime()
  const daysUntil = (start - now) / 86_400_000
  let percentage = 0
  if (daysUntil >= 7) percentage = 100
  else if (daysUntil >= 1) percentage = 50
  return { percentage, daysUntil }
}

export function refundAmount(totalUsd: number, startDate: string, now?: number): number {
  return Math.round(totalUsd * refundTier(startDate, now).percentage) / 100
}

/**
 * Predefined cancellation reason codes (Requirement 40.3 — "reason selection").
 * Each maps to an i18n key under `bookings.cancel.reasons.*`. The `other` option
 * reveals a free-text field so users can still describe an unlisted reason.
 */
export const CANCELLATION_REASONS = [
  'change_of_plans',
  'found_better_option',
  'travel_restrictions',
  'health_issue',
  'cost',
  'other',
] as const

export type CancellationReason = (typeof CANCELLATION_REASONS)[number]

/**
 * Resolve the reason text to send to the Backend API.
 * For predefined reasons we send the human-readable label; for `other` we send
 * the free-text the user typed (trimmed). Returns `undefined` when nothing usable
 * is available so the API omits the optional field.
 */
export function resolveCancellationReason(
  code: CancellationReason | '',
  label: string,
  freeText: string,
): string | undefined {
  if (!code) return undefined
  if (code === 'other') {
    const trimmed = freeText.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }
  return label
}

/** Milliseconds in 24 hours. */
const EMERGENCY_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * Whether a booking qualifies for the Emergency Alert entry point.
 *
 * Per Requirements 7.6 and 10.1, the Emergency_Alert button is shown when the
 * user has an *active* booking within 24 hours of its start time. "Active" here
 * means an upcoming, non-cancelled/non-completed booking (CONFIRMED, PENDING_PAYMENT,
 * HOLD — grouped as `upcoming`).
 *
 * The window opens 24 hours before start. The button remains available from then
 * through the booking start time (and is not hidden the moment the trip begins,
 * since travelers most need emergency help during the trip). It is hidden only
 * once the booking leaves the `upcoming` group (e.g. COMPLETED/CANCELLED/EXPIRED).
 *
 * Boundary: exactly 24 hours before start is inside the window (inclusive).
 *
 * @param startDate ISO date/time string of the booking start.
 * @param status    Booking status; defaults to the most permissive `CONFIRMED`.
 * @param now       Reference time in ms (defaults to Date.now()), injected for tests.
 */
export function isWithinEmergencyWindow(
  startDate: string,
  status: BookingStatus | string = 'CONFIRMED',
  now: number = Date.now(),
): boolean {
  if (bookingGroup(status) !== 'upcoming') return false
  const start = new Date(startDate).getTime()
  if (Number.isNaN(start)) return false
  const msUntilStart = start - now
  // Within 24h before start (inclusive of the 24h boundary) and not yet past start.
  return msUntilStart <= EMERGENCY_WINDOW_MS && msUntilStart >= 0
}
