import { describe, it, expect } from 'vitest'
import {
  bookingGroup,
  refundTier,
  refundAmount,
  statusVariant,
  resolveCancellationReason,
  CANCELLATION_REASONS,
} from '@/lib/bookings-display'

const DAY = 86_400_000
const HOUR = 3_600_000

describe('lib/bookings-display', () => {
  it('groups statuses into tabs', () => {
    expect(bookingGroup('CONFIRMED')).toBe('upcoming')
    expect(bookingGroup('PENDING_PAYMENT')).toBe('upcoming')
    expect(bookingGroup('HOLD')).toBe('upcoming')
    expect(bookingGroup('COMPLETED')).toBe('past')
    expect(bookingGroup('EXPIRED')).toBe('past')
    expect(bookingGroup('CANCELLED')).toBe('cancelled')
  })

  it('applies the tiered refund policy', () => {
    const now = Date.now()
    expect(refundTier(new Date(now + 10 * DAY).toISOString(), now).percentage).toBe(100)
    expect(refundTier(new Date(now + 3 * DAY).toISOString(), now).percentage).toBe(50)
    expect(refundTier(new Date(now + 12 * HOUR).toISOString(), now).percentage).toBe(0)
  })

  it('computes refund amounts', () => {
    const now = Date.now()
    expect(refundAmount(100, new Date(now + 10 * DAY).toISOString(), now)).toBe(100)
    expect(refundAmount(100, new Date(now + 3 * DAY).toISOString(), now)).toBe(50)
    expect(refundAmount(100, new Date(now + 1 * HOUR).toISOString(), now)).toBe(0)
  })

  it('maps status to badge variants', () => {
    expect(statusVariant('CONFIRMED')).toBe('success')
    expect(statusVariant('CANCELLED')).toBe('destructive')
    expect(statusVariant('PENDING_PAYMENT')).toBe('warning')
    expect(statusVariant('COMPLETED')).toBe('secondary')
  })

  describe('resolveCancellationReason (Requirement 40.3)', () => {
    it('exposes an "other" option for free-text alongside predefined reasons', () => {
      expect(CANCELLATION_REASONS).toContain('other')
      expect(CANCELLATION_REASONS.length).toBeGreaterThan(1)
    })

    it('returns undefined when no reason is selected', () => {
      expect(resolveCancellationReason('', '', '')).toBeUndefined()
    })

    it('sends the predefined label for a predefined reason', () => {
      expect(resolveCancellationReason('change_of_plans', 'Change of plans', '')).toBe(
        'Change of plans',
      )
    })

    it('sends the trimmed free-text for the "other" reason', () => {
      expect(resolveCancellationReason('other', 'Other', '  too busy  ')).toBe('too busy')
    })

    it('returns undefined when "other" is chosen but no free-text is given', () => {
      expect(resolveCancellationReason('other', 'Other', '   ')).toBeUndefined()
    })
  })
})
