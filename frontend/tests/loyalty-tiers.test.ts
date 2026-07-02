import { describe, it, expect } from 'vitest'
import {
  computeTierProgress,
  pointsToUsd,
  LOYALTY_TIERS,
  POINTS_PER_USD,
} from '@/lib/loyalty-tiers'

// Task 16.5 — loyalty tier / progress computation.

describe('computeTierProgress', () => {
  it('places a zero balance in the first (bronze) tier', () => {
    const p = computeTierProgress(0)
    expect(p.current.id).toBe('bronze')
    expect(p.next?.id).toBe('silver')
    expect(p.pointsToNext).toBe(1_000)
    expect(p.percent).toBe(0)
  })

  it('reports the halfway point within a tier', () => {
    // bronze [0, 1000) — 500 is halfway to silver.
    const p = computeTierProgress(500)
    expect(p.current.id).toBe('bronze')
    expect(p.pointsToNext).toBe(500)
    expect(p.percent).toBe(50)
  })

  it('promotes to the next tier exactly at its threshold', () => {
    const p = computeTierProgress(1_000)
    expect(p.current.id).toBe('silver')
    expect(p.next?.id).toBe('gold')
  })

  it('caps at the highest tier with no next tier', () => {
    const p = computeTierProgress(999_999)
    expect(p.current.id).toBe('platinum')
    expect(p.next).toBeNull()
    expect(p.pointsToNext).toBe(0)
    expect(p.percent).toBe(100)
  })

  it('clamps negative balances to the bottom tier', () => {
    const p = computeTierProgress(-50)
    expect(p.current.id).toBe('bronze')
    expect(p.percent).toBe(0)
  })

  it('handles non-finite input safely by clamping to the bottom tier', () => {
    expect(computeTierProgress(NaN).current.id).toBe('bronze')
    expect(computeTierProgress(Infinity).current.id).toBe('bronze')
  })

  it('sweeps a range of inputs keeping percent in [0,100] and pointsToNext non-negative', () => {
    for (let points = -1_000; points <= 100_000; points += 137) {
      const p = computeTierProgress(points)
      expect(p.percent).toBeGreaterThanOrEqual(0)
      expect(p.percent).toBeLessThanOrEqual(100)
      expect(p.pointsToNext).toBeGreaterThanOrEqual(0)
    }
  })

  it('keeps the balance within the current tier band for all non-negative inputs', () => {
    for (let points = 0; points <= 100_000; points += 211) {
      const p = computeTierProgress(points)
      expect(points).toBeGreaterThanOrEqual(p.current.threshold)
      if (p.next) expect(points).toBeLessThan(p.next.threshold)
    }
  })
})

describe('pointsToUsd', () => {
  it('converts points to dollars at the documented rate', () => {
    expect(pointsToUsd(POINTS_PER_USD)).toBe(1)
    expect(pointsToUsd(250)).toBe(2.5)
  })

  it('never returns a negative value', () => {
    expect(pointsToUsd(-100)).toBe(0)
    expect(pointsToUsd(0)).toBe(0)
  })
})

describe('LOYALTY_TIERS invariants', () => {
  it('is ordered ascending and starts at 0', () => {
    expect(LOYALTY_TIERS[0].threshold).toBe(0)
    for (let i = 1; i < LOYALTY_TIERS.length; i++) {
      expect(LOYALTY_TIERS[i].threshold).toBeGreaterThan(LOYALTY_TIERS[i - 1].threshold)
    }
  })
})
