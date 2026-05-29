import { BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { ErrorCode } from '../../../common/errors/error-codes';
import { assertTransition } from './transition-status.util';

describe('assertTransition', () => {
  // Legal transitions
  it.each([
    [BookingStatus.hold, BookingStatus.pending_payment],
    [BookingStatus.hold, BookingStatus.cancelled],
    [BookingStatus.hold, BookingStatus.expired],
    [BookingStatus.pending_payment, BookingStatus.confirmed],
    [BookingStatus.pending_payment, BookingStatus.cancelled],
    [BookingStatus.pending_payment, BookingStatus.expired],
    [BookingStatus.confirmed, BookingStatus.cancelled],
    [BookingStatus.confirmed, BookingStatus.completed],
  ])('allows %s → %s', (from, to) => {
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  it('rejects confirmed → hold with BKNG_CONFIRMED_CANNOT_MODIFY', () => {
    expect(() =>
      assertTransition(BookingStatus.confirmed, BookingStatus.hold),
    ).toThrow(BadRequestException);
    try {
      assertTransition(BookingStatus.confirmed, BookingStatus.hold);
    } catch (e: unknown) {
      const err = e as { response: { code: string } };
      expect(err.response.code).toBe(ErrorCode.BKNG_CONFIRMED_CANNOT_MODIFY);
    }
  });

  it('rejects cancelled → anything with BKNG_ALREADY_CANCELLED', () => {
    try {
      assertTransition(BookingStatus.cancelled, BookingStatus.confirmed);
    } catch (e: unknown) {
      const err = e as { response: { code: string } };
      expect(err.response.code).toBe(ErrorCode.BKNG_ALREADY_CANCELLED);
    }
  });

  it('rejects expired → anything with BKNG_EXPIRED', () => {
    try {
      assertTransition(BookingStatus.expired, BookingStatus.confirmed);
    } catch (e: unknown) {
      const err = e as { response: { code: string } };
      expect(err.response.code).toBe(ErrorCode.BKNG_EXPIRED);
    }
  });
});
