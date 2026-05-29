import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import { buildIcal } from '../utils';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

export interface IcalResult {
  filename: string;
  body: string;
}

/**
 * GET /v1/bookings/:id/ical — returns an RFC 5545 calendar body so the
 * traveller can drop their booking into Google Calendar / Apple Calendar.
 */
@Injectable()
export class GetBookingIcalUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(user: JwtPayload, id: string): Promise<IcalResult> {
    const row = await this.prisma.booking.findFirst({
      where: { id, deletedAt: null },
      include: { items: true },
    });
    if (!row) {
      throw new NotFoundException({
        code: ErrorCode.BKNG_NOT_FOUND,
        message: 'Not found',
      });
    }
    if (row.userId !== user.sub) {
      throw new ForbiddenException({
        code: ErrorCode.BKNG_NOT_AUTHOR,
        message: 'Not your booking',
      });
    }

    return {
      filename: `${row.reference}.ics`,
      body: buildIcal(row, row.items),
    };
  }
}
