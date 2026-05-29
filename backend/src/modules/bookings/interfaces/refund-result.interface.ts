/** Result of a successful POST /v1/bookings/:id/cancel call. */
export interface RefundResult {
  refundAmountUsd: number;
  refundPercentage: 0 | 50 | 100;
  refundMethod: string | null;
}
