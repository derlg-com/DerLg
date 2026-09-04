import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { AuditEventType, DriverStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { DriverResponseDto } from '../dto/driver-response.dto';

@Injectable()
export class AdminDriversService {
  private readonly logger = new Logger(AdminDriversService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getAllDrivers(filters: {
    status?: string;
    search?: string;
    hasTelegram?: boolean;
    page?: string;
    limit?: string;
  }) {
    const { status, search, hasTelegram, page, limit } = filters;
    const currentPage = Math.max(1, parseInt(page || '1', 10));
    const take = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));
    const skip = (currentPage - 1) * take;

    const where: Prisma.DriverWhereInput = {};

    if (status) {
      const normalized = status.toUpperCase();
      if (Object.values(DriverStatus).includes(normalized as DriverStatus)) {
        where.status = normalized as DriverStatus;
      }
    }

    // Drives the "Registered / Not registered" dropdown on the drivers page,
    // which previously sent `has_telegram` to a handler that did not read it.
    if (hasTelegram !== undefined) {
      where.telegramId = hasTelegram ? { not: null } : null;
    }

    if (search) {
      where.OR = [
        { driverName: { contains: search, mode: 'insensitive' } },
        { driverId: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.driver.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        // The list renders a Vehicle column. Without this include the relation is
        // absent from the payload and the column rendered empty for every row.
        include: {
          vehicle: {
            select: { id: true, name: true, licensePlate: true },
          },
        },
      }),
      this.prisma.driver.count({ where }),
    ]);

    return {
      data,
      meta: {
        page: currentPage,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async getDriverById(id: string): Promise<DriverResponseDto> {
    const driver = await this.prisma.driver.findUnique({
      where: { id },
      include: {
        assignments: {
          orderBy: { assignmentTimestamp: 'desc' },
          take: 50,
        },
        _count: {
          select: { assignments: true },
        },
      },
    });

    if (!driver) {
      throw new NotFoundException(`Driver with id ${id} not found`);
    }

    let vehicle: {
      id: string;
      name: string;
      vehicleType: string;
      capacity: number;
      licensePlate: string | null;
    } | null = null;
    if (driver.vehicleId) {
      vehicle = await this.prisma.transportationVehicle.findUnique({
        where: { id: driver.vehicleId },
        select: {
          id: true,
          name: true,
          vehicleType: true,
          capacity: true,
          licensePlate: true,
        },
      });
    }

    return {
      id: driver.id,
      driverName: driver.driverName,
      driverId: driver.driverId,
      telegramId: driver.telegramId,
      phone: driver.phone,
      vehicleId: driver.vehicleId,
      status: driver.status,
      preferredLanguage: driver.preferredLanguage,
      lastStatusUpdate: driver.lastStatusUpdate,
      lastTelegramActivity: driver.lastTelegramActivity,
      createdAt: driver.createdAt,
      updatedAt: driver.updatedAt,
      vehicle,
      assignmentCount: driver._count?.assignments ?? driver.assignments.length,
      assignments: driver.assignments,
    };
  }

  async createDriver(dto: {
    driverName: string;
    driverId: string;
    telegramId?: string;
    phone: string;
    vehicleId?: string;
  }) {
    if (dto.telegramId) {
      const existing = await this.prisma.driver.findUnique({
        where: { telegramId: BigInt(dto.telegramId) },
      });
      if (existing) {
        throw new ConflictException(
          `Telegram ID ${dto.telegramId} is already registered`,
        );
      }
    }

    const authPin = this.generatePin();

    const driver = await this.prisma.driver.create({
      data: {
        driverName: dto.driverName,
        driverId: dto.driverId,
        telegramId: dto.telegramId ? BigInt(dto.telegramId) : null,
        authPin,
        phone: dto.phone,
        vehicleId: dto.vehicleId || null,
        status: DriverStatus.OFFLINE,
      },
    });

    this.logger.log(`Driver created: ${driver.id} with PIN ${authPin}`);

    return driver;
  }

  async updateDriver(
    id: string,
    dto: {
      driverName?: string;
      driverId?: string;
      telegramId?: string;
      phone?: string;
      vehicleId?: string | null;
      status?: DriverStatus;
    },
  ) {
    const existing = await this.prisma.driver.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Driver with id ${id} not found`);
    }

    if (dto.telegramId) {
      const telegramBigInt = BigInt(dto.telegramId);
      const conflict = await this.prisma.driver.findFirst({
        where: {
          telegramId: telegramBigInt,
          NOT: { id },
        },
      });
      if (conflict) {
        throw new ConflictException(
          `Telegram ID ${dto.telegramId} is already registered`,
        );
      }
    }

    const data: Prisma.DriverUpdateInput = {};
    if (dto.driverName !== undefined) data.driverName = dto.driverName;
    if (dto.driverId !== undefined) data.driverId = dto.driverId;
    if (dto.telegramId !== undefined) {
      data.telegramId = dto.telegramId ? BigInt(dto.telegramId) : null;
    }
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.vehicleId !== undefined) {
      // A relation, not a scalar, on DriverUpdateInput: reassigning means
      // connect, and clearing means disconnect. Assigning the raw id would not
      // type-check and would silently do nothing at runtime.
      data.vehicle = dto.vehicleId
        ? { connect: { id: dto.vehicleId } }
        : { disconnect: true };
    }
    if (dto.status !== undefined) {
      data.status = dto.status;
      data.lastStatusUpdate = new Date();
    }

    const driver = await this.prisma.driver.update({ where: { id }, data });

    if (dto.status && dto.status !== existing.status) {
      await this.publishStatusChange(driver.id, driver.status);
    }

    return driver;
  }

  async deactivateDriver(id: string) {
    const existing = await this.prisma.driver.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Driver with id ${id} not found`);
    }

    const driver = await this.prisma.driver.update({
      where: { id },
      data: {
        status: DriverStatus.OFFLINE,
        lastStatusUpdate: new Date(),
      },
    });

    await this.publishStatusChange(driver.id, driver.status);

    return driver;
  }

  private generatePin(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async publishStatusChange(
    driverId: string,
    status: DriverStatus,
  ): Promise<void> {
    const channel = `driver_status_changed:${driverId}`;
    const payload = JSON.stringify({
      driverId,
      status,
      timestamp: new Date().toISOString(),
    });

    try {
      await this.redis.getClient().publish(channel, payload);
      this.logger.debug(`Published status change to ${channel}`);
    } catch (error) {
      this.logger.warn(`Redis publish failed: ${(error as Error).message}`);
    }
  }

  async createAuditLog(params: {
    userId?: string;
    eventType: AuditEventType;
    entityType: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: params.userId || null,
          eventType: params.eventType,
          entityType: params.entityType,
          entityId: params.entityId || null,
          metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Audit log creation failed: ${(error as Error).message}`,
      );
    }
  }
}
