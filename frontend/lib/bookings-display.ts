import type { BookingStatus } from '@/types/api'

export type BookingGroup = 'upcoming' | 'past' | 'cancelled'

/** Group a raw booking status into the My Trips tabs. */
export function bookingGroup(status: BookingStatus | string): BookingGroup {
  if (status === 'CANCELLED') return 'cancelled'
  if (status === 'COMPLETED' || status === 'EXPIRED') return 'past'
  return 'upcoming' // CONFIRMED, PENDING_PAYMENT, HOLD
}

export type StatusBadgeVariant =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'muted'
  | 'success'
  | 'warning'
  | 'destructive'

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
