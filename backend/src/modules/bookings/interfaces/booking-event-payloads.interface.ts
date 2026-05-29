import type { BookingMethod, SingleResourceKind } from '@prisma/client';

/**
 * Domain event payloads emitted from CommitBookingUseCase / CancelBookingUseCase /
 * ExpireHoldUseCase via EventEmitter2. Phase 8 will subscribe to drive
 * notifications, loyalty accrual, and cleanup side effects.
 */

export interface BookingCreatedEvent {
  bookingId: string;
  userId: string;
  method: BookingMethod;
  singleResourceKind: SingleResourceKind | null;
  tripTemplateId: string | null;
  reference: string;
  totalUsd: number;
  startDate: string;
  endDate: string | null;
  status: 'hold';
  createdAt: string;
}

export interface BookingCancelledEvent {
  bookingId: string;
  userId: string;
  reference: string;
  refundAmountUsd: number;
  refundPercentage: 0 | 50 | 100;
  cancelledAt: string;
}

export interface BookingExpiredEvent {
  bookingId: string;
  userId: string;
  reference: string;
  expiredAt: string;
}
