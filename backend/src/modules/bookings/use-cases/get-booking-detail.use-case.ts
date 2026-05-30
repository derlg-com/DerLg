import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import { mapBookingDetail } from '../utils';
import type { BookingDetail } from '../interfaces';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

@Injectable()
export class GetBookingDetailUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(user: JwtPayload, id: string): Promise<BookingDetail> {
    const row = await this.prisma.booking.findFirst({
      where: { id, deletedAt: null },
      include: { items: true },
    });

    if (!row) {
      throw new NotFoundException({
        code: ErrorCode.BKNG_NOT_FOUND,
        message: 'Booking not found',
      });
    }

    if (row.userId !== user.sub) {
      throw new ForbiddenException({
        code: ErrorCode.BKNG_NOT_AUTHOR,
        message: 'You are not authorised to view this booking',
      });
    }

    return mapBookingDetail(row);
  }
}
