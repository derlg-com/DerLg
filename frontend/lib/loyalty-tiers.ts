/**
 * Loyalty reward tiers and progress computation (Requirement 34.8).
 *
 * NOTE (backend-contract assumption): the backend does not currently define
 * loyalty tiers — it only stores a flat `loyaltyPoints` balance per user. The
 * tier thresholds and conversion rate below are therefore a sensible
 * frontend-side definition so we can render the "progress toward next tier"
 * bar (Requirement 34.8) and redemption information (Requirement 34.6). When
 * the backend introduces a canonical tier model, replace {@link LOYALTY_TIERS}
 * and {@link POINTS_PER_USD} with values fetched from the API.
 *
 * This module is intentionally pure (no React / no I/O) so the tier math is
 * unit-testable in isolation.
 */

export interface LoyaltyTier {
  /** Stable identifier used for i18n keys and styling. */
  id: 'bronze' | 'silver' | 'gold' | 'platinum'
  /** Minimum lifetime/balance points required to be in this tier. */
  threshold: number
}

/** Ordered ascending by threshold. The first tier MUST start at 0. */
export const LOYALTY_TIERS: readonly LoyaltyTier[] = [
  { id: 'bronze', threshold: 0 },
  { id: 'silver', threshold: 1_000 },
  { id: 'gold', threshold: 5_000 },
  { id: 'platinum', threshold: 15_000 },
] as const

/**
 * Points required to redeem 1 USD of discount (Requirement 34.6).
 * Assumption: 100 points = $1. Documented here so the redemption section and
 * conversion-rate copy stay in sync.
 */
export const POINTS_PER_USD = 100

export interface TierProgress {
  /** The tier the balance currently sits in. */
  current: LoyaltyTier
  /** The next tier up, or `null` when already at the highest tier. */
  next: LoyaltyTier | null
  /** Points still needed to reach {@link next}; 0 when at the top tier. */
  pointsToNext: number
  /**
   * Progress through the current tier toward the next, as a percentage
   * (0–100). Always 100 when at the highest tier.
   */
  percent: number
}

/**
 * Compute which tier a points balance falls into and how far it is toward the
 * next tier. Negative balances are clamped to 0.
 */
export function computeTierProgress(points: number): TierProgress {
  const balance = Number.isFinite(points) && points > 0 ? Math.floor(points) : 0

  // Find the highest tier whose threshold the balance meets.
  let currentIndex = 0
  for (let i = 0; i < LOYALTY_TIERS.length; i++) {
    if (balance >= LOYALTY_TIERS[i].threshold) currentIndex = i
    else break
  }

  const current = LOYALTY_TIERS[currentIndex]
  const next = LOYALTY_TIERS[currentIndex + 1] ?? null

  if (!next) {
    return { current, next: null, pointsToNext: 0, percent: 100 }
  }

  const span = next.threshold - current.threshold
  const progressed = balance - current.threshold
  const pointsToNext = Math.max(0, next.threshold - balance)
  const percent = span <= 0 ? 100 : Math.min(100, Math.max(0, (progressed / span) * 100))

  return { current, next, pointsToNext, percent }
}

/**
 * Convert a points balance to its redeemable USD value (Requirement 34.6).
 * Truncates to whole cents and never returns a negative value.
 */
export function pointsToUsd(points: number): number {
  const balance = Number.isFinite(points) && points > 0 ? points : 0
  return Math.floor((balance / POINTS_PER_USD) * 100) / 100
}
