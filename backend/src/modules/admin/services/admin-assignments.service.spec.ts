import { BadRequestException, NotFoundException } from '@nestjs/common';

import { AdminAssignmentsService } from './admin-assignments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { TelegramService } from '../../telegram/telegram.service';

/**
 * `vehicleId` became optional on `AssignDriverDto`.
 *
 * The admin panel's assign dialog only picks a driver — it has no vehicle field —
 * so it sent `vehicleId: ''`, which failed `@IsUUID()` and made driver assignment
 * return 400 every time. Drivers already record the vehicle they operate, so that
 * is the natural default.
 */
describe('AdminAssignmentsService.assignDriver vehicle resolution', () => {
  let service: AdminAssignmentsService;
  let prisma: {
    driver: { findUnique: jest.Mock; update: jest.Mock };
    booking: { findUnique: jest.Mock };
    transportationVehicle: { findUnique: jest.Mock };
    vehicleMaintenance: { findFirst: jest.Mock };
    driverAssignment: { create: jest.Mock };
  };

  const AVAILABLE_DRIVER = {
    id: 'driver-1',
    driverId: 'DRV-001',
    status: 'AVAILABLE',
    vehicleId: 'vehicle-from-driver',
  };

  beforeEach(() => {
    prisma = {
      driver: {
        findUnique: jest.fn().mockResolvedValue(AVAILABLE_DRIVER),
        update: jest.fn().mockResolvedValue({}),
      },
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-1',
          passengerCount: 2,
        }),
      },
      transportationVehicle: {
        findUnique: jest.fn().mockResolvedValue({ id: 'v', capacity: 8 }),
      },
      vehicleMaintenance: { findFirst: jest.fn().mockResolvedValue(null) },
      driverAssignment: {
        create: jest.fn().mockResolvedValue({ id: 'assignment-1' }),
      },
    };

    service = new AdminAssignmentsService(
      prisma as unknown as PrismaService,
      { getClient: () => ({ publish: jest.fn() }) } as unknown as RedisService,
      {
        sendAssignmentNotification: jest.fn(),
        queueAssignmentTimeout: jest.fn(),
      } as unknown as TelegramService,
    );
  });

  it("falls back to the driver's own vehicle when none is supplied", async () => {
    await service.assignDriver({
      driverId: 'driver-1',
      bookingId: 'booking-1',
    });

    expect(prisma.driverAssignment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ vehicleId: 'vehicle-from-driver' }),
    });
  });

  it('honours an explicitly supplied vehicle', async () => {
    await service.assignDriver({
      driverId: 'driver-1',
      bookingId: 'booking-1',
      vehicleId: 'explicit-vehicle',
    });

    expect(prisma.driverAssignment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ vehicleId: 'explicit-vehicle' }),
    });
  });

  it('validates the resolved vehicle, not just the supplied one', async () => {
    // The capacity and maintenance checks must apply to the fallback too.
    prisma.transportationVehicle.findUnique.mockResolvedValue({
      id: 'vehicle-from-driver',
      capacity: 1,
    });

    await expect(
      service.assignDriver({ driverId: 'driver-1', bookingId: 'booking-1' }),
    ).rejects.toThrow(/capacity/i);
  });

  it('rejects a maintenance-blocked fallback vehicle', async () => {
    prisma.vehicleMaintenance.findFirst.mockResolvedValue({
      status: 'IN_MAINTENANCE',
    });

    await expect(
      service.assignDriver({ driverId: 'driver-1', bookingId: 'booking-1' }),
    ).rejects.toThrow(/maintenance/i);
  });

  it('asks for a vehicle when the driver has none', async () => {
    prisma.driver.findUnique.mockResolvedValue({
      ...AVAILABLE_DRIVER,
      vehicleId: null,
    });

    await expect(
      service.assignDriver({ driverId: 'driver-1', bookingId: 'booking-1' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.driverAssignment.create).not.toHaveBeenCalled();
  });

  it('still rejects an unknown vehicle id', async () => {
    prisma.transportationVehicle.findUnique.mockResolvedValue(null);

    await expect(
      service.assignDriver({
        driverId: 'driver-1',
        bookingId: 'booking-1',
        vehicleId: 'nope',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
