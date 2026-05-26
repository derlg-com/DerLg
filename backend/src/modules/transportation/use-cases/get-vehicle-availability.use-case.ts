import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CachedService } from '../../../common/cache/cached.service';
import { vehicleAvailabilityKey } from '../../../common/cache/cache-keys';
import { ErrorCode } from '../../../common/errors/error-codes';
import { buildBusyRanges } from '../utils';
import type { AvailabilityQueryDto } from '../dto';
import type { VehicleAvailability } from '../interfaces';
import { BookingStatus } from '@prisma/client';

@Injectable()
export class GetVehicleAvailabilityUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CachedService,
  ) {}

  async execute(
    vehicleId: string,
    query: AvailabilityQueryDto,
  ): Promise<VehicleAvailability> {
    const { from, to } = query;

    const vehicle = await this.prisma.transportationVehicle.findFirst({
      where: { id: vehicleId, isActive: true },
      select: { id: true },
    });

    if (!vehicle) {
      throw new NotFoundException({
        code: ErrorCode.TRN_NOT_FOUND,
        message: 'Vehicle not found',
      });
    }

    return this.cache.getOrSet(
      vehicleAvailabilityKey(vehicleId, from, to),
      120,
      async () => {
        const fromDate = new Date(from);
        const toDate = new Date(to);

        const bookingItems = await this.prisma.bookingItem.findMany({
          where: {
            vehicleId,
            date: { gte: fromDate, lt: toDate },
            booking: {
              status: { in: [BookingStatus.reserved, BookingStatus.confirmed] },
            },
          },
          select: { date: true },
        });

        return {
          vehicleId,
          busyRanges: buildBusyRanges(bookingItems, fromDate, toDate),
        };
      },
    );
  }
}
