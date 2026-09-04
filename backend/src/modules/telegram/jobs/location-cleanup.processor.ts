import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import type { LocationCleanupJobData } from './job-payloads';
import { RedisService } from '../../redis/redis.service';

@Processor('location-cleanup')
export class LocationCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(LocationCleanupProcessor.name);

  constructor(private readonly redis: RedisService) {
    super();
  }

  async process(job: Job<LocationCleanupJobData>): Promise<unknown> {
    const { driverId } = job.data;

    this.logger.log(`Processing location cleanup for driver ${driverId}`);

    const locationKey = `driver_location:${driverId}`;
    const exists = await this.redis.getClient().exists(locationKey);

    if (exists) {
      await this.redis.getClient().del(locationKey);
      this.logger.log(`Cleared stale location for driver ${driverId}`);
      return { action: 'cleared', driverId };
    }

    this.logger.debug(`No stale location found for driver ${driverId}`);
    return { action: 'no_location', driverId };
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Location cleanup job ${job.id} failed: ${err.message}`);
  }
}
