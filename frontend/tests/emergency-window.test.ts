import { describe, it, expect } from 'vitest'
import { isWithinEmergencyWindow } from '@/lib/bookings-display'

// Task 14.5 — Emergency Alert 24-hour window helper.
//
// Per Requirements 7.6 and 10.1, the Emergency_Alert button is shown when the
// user has an *active* booking within 24 hours of its start time. This verifies
// the pure gate: the window opens exactly 24h before start (inclusive), stays
// open through the start instant, and is closed for non-upcoming statuses and
// for starts more than 24h away or already in the past.

const NOW = Date.parse('2026-12-01T12:00:00Z')
const HOUR = 60 * 60 * 1000

function iso(msFromNow: number): string {
  return new Date(NOW + msFromNow).toISOString()
}

describe('isWithinEmergencyWindow (Req 7.6, 10.1)', () => {
  it('is true when the start is well within 24h (e.g. 6h away)', () => {
    expect(isWithinEmergencyWindow(iso(6 * HOUR), 'CONFIRMED', NOW)).toBe(true)
  })

  it('is true exactly at the 24h boundary (inclusive)', () => {
    expect(isWithinEmergencyWindow(iso(24 * HOUR), 'CONFIRMED', NOW)).toBe(true)
  })

  it('is false just outside the 24h boundary (24h + 1ms away)', () => {
    expect(isWithinEmergencyWindow(iso(24 * HOUR + 1), 'CONFIRMED', NOW)).toBe(false)
  })

  it('is true at the exact start instant (boundary, inclusive)', () => {
    expect(isWithinEmergencyWindow(iso(0), 'CONFIRMED', NOW)).toBe(true)
  })

  it('is false once the start time has passed', () => {
    expect(isWithinEmergencyWindow(iso(-1), 'CONFIRMED', NOW)).toBe(false)
  })

  it('is false for starts far in the future (2 days away)', () => {
    expect(isWithinEmergencyWindow(iso(48 * HOUR), 'CONFIRMED', NOW)).toBe(false)
  })

  it('honours upcoming-group statuses (PENDING_PAYMENT, HOLD)', () => {
    expect(isWithinEmergencyWindow(iso(6 * HOUR), 'PENDING_PAYMENT', NOW)).toBe(true)
    expect(isWithinEmergencyWindow(iso(6 * HOUR), 'HOLD', NOW)).toBe(true)
  })

  it('is false for non-active statuses even inside the time window', () => {
    for (const status of ['CANCELLED', 'COMPLETED', 'EXPIRED']) {
      expect(isWithinEmergencyWindow(iso(6 * HOUR), status, NOW)).toBe(false)
    }
  })

  it('defaults status to CONFIRMED and now to current time', () => {
    // No status / now passed: a start ~1h from real now should qualify.
    expect(isWithinEmergencyWindow(new Date(Date.now() + HOUR).toISOString())).toBe(true)
  })

  it('is false for an unparseable start date', () => {
    expect(isWithinEmergencyWindow('not-a-date', 'CONFIRMED', NOW)).toBe(false)
  })
})
