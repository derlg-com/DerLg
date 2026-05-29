import { Prisma } from '@prisma/client';

export interface RefundInput {
  startDate: Date;
  totalUsd: Prisma.Decimal;
}

export interface RefundResult {
  amountUsd: number;
  percentage: 0 | 50 | 100;
}

const MS_PER_DAY = 86_400_000;

/**
 * Cancellation refund tiers per CONSTITUTION.md § 9.3:
 *   > 7 days  → 100%
 *   3-7 days → 50%
 *   < 3 days → 0%
 *
 * Boundaries: exactly 7 days = 50%, exactly 3 days = 0%, already-started = 0%.
 * Day count is `floor((startDate - now) / 1day)`, truncated to UTC midnight
 * on both sides so server timezone is irrelevant.
 */
export function computeRefund(booking: RefundInput, now: Date): RefundResult {
  const startMidnight = Date.UTC(
    booking.startDate.getUTCFullYear(),
    booking.startDate.getUTCMonth(),
    booking.startDate.getUTCDate(),
  );
  const nowMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );

  const daysUntilStart = Math.floor((startMidnight - nowMidnight) / MS_PER_DAY);

  let percentage: 0 | 50 | 100;
  if (daysUntilStart > 7) percentage = 100;
  else if (daysUntilStart >= 4) percentage = 50;
  else percentage = 0;

  const amountUsd = booking.totalUsd.mul(percentage).div(100).toNumber();

  return { amountUsd, percentage };
}
