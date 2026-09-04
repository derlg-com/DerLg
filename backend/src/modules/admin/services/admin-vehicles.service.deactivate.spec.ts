import { NotFoundException } from '@nestjs/common';

import { AdminVehiclesService } from './admin-vehicles.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AdminVehiclesService.deactivateVehicle', () => {
  let service: AdminVehiclesService;
  let prisma: {
    transportationVehicle: { findUnique: jest.Mock; update: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      transportationVehicle: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new AdminVehiclesService(prisma as unknown as PrismaService);
  });

  it('clears isActive rather than deleting the row', async () => {
    // A hard DELETE would be rejected by booking_items' foreign key, or would
    // orphan completed bookings and corrupt revenue reporting.
    prisma.transportationVehicle.findUnique.mockResolvedValue({
      id: 'v1',
      isActive: true,
    });
    prisma.transportationVehicle.update.mockResolvedValue({
      id: 'v1',
      name: 'Hiace 01',
      isActive: false,
    });

    const result = await service.deactivateVehicle('v1');

    expect(prisma.transportationVehicle.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: { isActive: false },
    });
    expect(result.isActive).toBe(false);
  });

  it('throws NotFound for an unknown vehicle', async () => {
    prisma.transportationVehicle.findUnique.mockResolvedValue(null);

    await expect(service.deactivateVehicle('missing')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.transportationVehicle.update).not.toHaveBeenCalled();
  });

  it('is idempotent for an already inactive vehicle', async () => {
    prisma.transportationVehicle.findUnique.mockResolvedValue({
      id: 'v1',
      isActive: false,
    });
    prisma.transportationVehicle.update.mockResolvedValue({
      id: 'v1',
      isActive: false,
    });

    await expect(service.deactivateVehicle('v1')).resolves.toMatchObject({
      isActive: false,
    });
  });
});
