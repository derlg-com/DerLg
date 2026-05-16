import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';

/** Root controller. Only exposes the health check endpoint. */
@Controller()
export class AppController {
  /** Public health check for load balancers and monitoring. */
  @Get('health')
  @Public()
  getHealth(): { status: string; service: string } {
    return { status: 'ok', service: 'derlg-backend' };
  }
}
