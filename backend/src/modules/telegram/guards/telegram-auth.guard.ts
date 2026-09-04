import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { DriverStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

import type { Request } from 'express';

/** Driver identity attached to the request for downstream handlers. */
export interface RequestDriver {
  id: string;
  driverId: string;
  driverName: string;
  status: DriverStatus;
  preferredLanguage: string;
  vehicleId: string | null;
}

/**
 * Cache lifetime for a resolved driver.
 *
 * Five minutes, not the 30 days the previous version used. That cache held the
 * full driver row and was never invalidated, so a driver removed from the fleet
 * kept working access — able to accept trips and post locations — for a month
 * after deletion.
 */
const DRIVER_CACHE_TTL_SECONDS = 5 * 60;

/**
 * Authenticates a driver by Telegram id for the bot's own endpoints.
 *
 * Registration binds `drivers.telegram_id`, so possession of a Telegram account
 * that is bound to a driver row is the credential.
 */
@Injectable()
export class TelegramAuthGuard implements CanActivate {
  private readonly logger = new Logger(TelegramAuthGuard.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { driver?: RequestDriver }>();

    const raw =
      (request.body as { telegramId?: unknown } | undefined)?.telegramId ??
      (request.query as { telegramId?: unknown } | undefined)?.telegramId;

    if (raw === undefined || raw === null || raw === '') {
      throw new UnauthorizedException('telegramId is required');
    }

    // Validate before BigInt(): the value comes straight off the request, and
    // BigInt('abc') throws a TypeError that would surface as a 500 rather than
    // the 400 this is. Only primitives are accepted — an object would stringify
    // to "[object Object]" and then fail the digit check anyway, but rejecting it
    // here keeps the intent obvious.
    if (typeof raw !== 'string' && typeof raw !== 'number') {
      throw new BadRequestException('telegramId must be a string or number');
    }
    const asString = String(raw);
    if (!/^\d{1,19}$/.test(asString)) {
      throw new BadRequestException('telegramId must be a positive integer');
    }

    const cacheKey = `telegram_driver:${asString}`;

    try {
      const cached = await this.redis.getClient().get(cacheKey);
      if (cached) {
        request.driver = JSON.parse(cached) as RequestDriver;
        return true;
      }
    } catch (error) {
      this.logger.warn('Driver cache read failed', {
        error: (error as Error).message,
      });
    }

    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(asString) },
      select: {
        id: true,
        driverId: true,
        driverName: true,
        status: true,
        preferredLanguage: true,
        vehicleId: true,
      },
    });

    if (!driver) {
      throw new UnauthorizedException(
        'Driver not found or not registered with Telegram',
      );
    }

    // Only the fields handlers need are cached — never authPin or phone.
    const resolved: RequestDriver = {
      id: driver.id,
      driverId: driver.driverId,
      driverName: driver.driverName,
      status: driver.status,
      preferredLanguage: driver.preferredLanguage,
      vehicleId: driver.vehicleId,
    };

    try {
      await this.redis
        .getClient()
        .setex(cacheKey, DRIVER_CACHE_TTL_SECONDS, JSON.stringify(resolved));
    } catch (error) {
      this.logger.warn('Driver cache write failed', {
        error: (error as Error).message,
      });
    }

    request.driver = resolved;
    return true;
  }
}
