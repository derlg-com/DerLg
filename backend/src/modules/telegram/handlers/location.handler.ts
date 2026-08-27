import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class LocationHandler {
  private readonly logger = new Logger(LocationHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async handleLocation(
    telegramId: string,
    latitude: number,
    longitude: number,
  ) {
    const driver = await this.prisma.driver.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      return { text: 'Driver not registered.' };
    }

    // Store in Redis with 5-min TTL
    const locationKey = `driver_location:${driver.id}`;
    await this.redis.getClient().setex(
      locationKey,
      5 * 60,
      JSON.stringify({
        latitude,
        longitude,
        timestamp: new Date().toISOString(),
      }),
    );

    // Publish location update
    await this.redis.getClient().publish(
      `driver_location_updated:${driver.id}`,
      JSON.stringify({
        driverId: driver.id,
        latitude,
        longitude,
        timestamp: new Date().toISOString(),
      }),
    );

    // Update last activity
    await this.prisma.driver.update({
      where: { id: driver.id },
      data: { lastTelegramActivity: new Date() },
    });

    return { text: 'Location updated.' };
  }
}
