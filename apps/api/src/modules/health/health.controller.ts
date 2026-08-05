import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { HealthReport, HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  check(): Promise<HealthReport> {
    return this.healthService.check();
  }
}
