import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { mapBooking } from '../utils';
import type { ListBookingsQueryDto } from '../dto';
import type { Booking } from '../interfaces';
import type { PaginatedResponse } from '../../../common/types/paginated-response.type';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

@Injectable()
export class ListBookingsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    user: JwtPayload,
    query: ListBookingsQueryDto,
  ): Promise<PaginatedResponse<Booking>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = {
      userId: user.sub,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.method ? { method: query.method } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { items: true },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      items: rows.map(mapBooking),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
