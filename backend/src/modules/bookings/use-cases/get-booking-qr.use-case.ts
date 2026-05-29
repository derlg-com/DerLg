import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

/**
 * GET /v1/bookings/:id/qr — returns the booking's QR-code URL. The
 * Phase 6 payment flow will populate `Booking.qrCodeUrl` with a CDN-
 * hosted PNG / Bakong deep-link; until then we return a placeholder
 * pointing at the frontend's QR view route.
 */
@Injectable()
export class GetBookingQrUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async execute(user: JwtPayload, id: string): Promise<{ qrCodeUrl: string }> {
    const row = await this.prisma.booking.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, userId: true, reference: true, qrCodeUrl: true },
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

    const frontendUrl = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    return {
      qrCodeUrl: row.qrCodeUrl ?? `${frontendUrl}/bookings/${row.reference}/qr`,
    };
  }
}
