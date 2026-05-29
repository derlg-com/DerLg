import { BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { ErrorCode } from '../../../common/errors/error-codes';

const LEGAL: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatus.hold]: [
    BookingStatus.pending_payment,
    BookingStatus.cancelled,
    BookingStatus.expired,
  ],
  [BookingStatus.pending_payment]: [
    BookingStatus.confirmed,
    BookingStatus.cancelled,
    BookingStatus.expired,
    BookingStatus.payment_failed,
  ],
  [BookingStatus.confirmed]: [BookingStatus.cancelled, BookingStatus.completed],
  [BookingStatus.cancelled]: [],
  [BookingStatus.expired]: [],
  [BookingStatus.payment_failed]: [
    BookingStatus.pending_payment,
    BookingStatus.cancelled,
  ],
  [BookingStatus.completed]: [],
  [BookingStatus.no_show]: [],
};

/**
 * Throws BadRequestException with the documented BKNG_* code if the
 * (from → to) transition is not legal per the booking state machine.
 *
 * State machine (from CONSTITUTION.md § 9.2):
 *   hold            → pending_payment | cancelled | expired
 *   pending_payment → confirmed | cancelled | expired | payment_failed
 *   confirmed       → cancelled | completed
 *   payment_failed  → pending_payment | cancelled
 *   cancelled / expired / completed / no_show → terminal
 */
export function assertTransition(from: BookingStatus, to: BookingStatus): void {
  if (LEGAL[from].includes(to)) return;

  if (from === BookingStatus.cancelled) {
    throw new BadRequestException({
      code: ErrorCode.BKNG_ALREADY_CANCELLED,
      message: `Cannot transition cancelled booking to ${to}`,
    });
  }
  if (from === BookingStatus.expired) {
    throw new BadRequestException({
      code: ErrorCode.BKNG_EXPIRED,
      message: `Cannot transition expired booking to ${to}`,
    });
  }
  if (from === BookingStatus.confirmed) {
    throw new BadRequestException({
      code: ErrorCode.BKNG_CONFIRMED_CANNOT_MODIFY,
      message: `Cannot transition confirmed booking to ${to}`,
    });
  }
  throw new BadRequestException({
    code: ErrorCode.BKNG_INVALID_DATE_RANGE,
    message: `Illegal transition: ${from} → ${to}`,
  });
}
