/**
 * Cancellation refund policy, from docs/product/feature-decisions.md:
 *   7 days or more before departure  -> 100%
 *   1 to 7 days before departure     ->  50%
 *   less than 24 hours               ->   0%
 *
 * Kept as a pure function so the tiers are auditable and testable without a
 * database or a Stripe account.
 */

export type RefundTier = 'FULL' | 'HALF' | 'NONE';

export interface RefundDecision {
  tier: RefundTier;
  /** 0, 50 or 100. */
  percentage: number;
  amountCents: number;
  daysUntilDeparture: number;
  reason: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole days between `now` and departure; negative once the trip has started. */
export function daysUntilDeparture(startDate: Date, now: Date): number {
  return Math.floor((startDate.getTime() - now.getTime()) / MS_PER_DAY);
}

export function decideRefund(input: {
  paidCents: number;
  startDate: Date;
  now?: Date;
}): RefundDecision {
  const now = input.now ?? new Date();
  const days = daysUntilDeparture(input.startDate, now);

  if (days >= 7) {
    return {
      tier: 'FULL',
      percentage: 100,
      amountCents: input.paidCents,
      daysUntilDeparture: days,
      reason: 'Cancelled seven or more days before departure.',
    };
  }

  if (days >= 1) {
    return {
      tier: 'HALF',
      percentage: 50,
      // Round down so rounding never favours the customer against the operator.
      amountCents: Math.floor(input.paidCents / 2),
      daysUntilDeparture: days,
      reason: 'Cancelled between one and seven days before departure.',
    };
  }

  return {
    tier: 'NONE',
    percentage: 0,
    amountCents: 0,
    daysUntilDeparture: days,
    reason: 'Cancelled less than twenty-four hours before departure.',
  };
}
