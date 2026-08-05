import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { AvailabilityAndPrice, AvailabilityService } from './availability.service';
import { CheckAvailabilityDto } from './dto/check-availability.dto';

@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  /**
   * Speculative check used while the traveller edits an itinerary. Public so
   * the price and availability preview works before sign-up; it exposes only
   * capacity counts, never anyone else's booking data.
   */
  @Post('check')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Availability checked')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  check(@Body() dto: CheckAvailabilityDto): Promise<AvailabilityAndPrice> {
    return this.availability.check(dto);
  }

  /**
   * Authoritative re-check taken immediately before a hold or payment. Fails
   * with AVAILABILITY_UNAVAILABLE (409) plus per-item detail when something has
   * sold out since the traveller last looked.
   */
  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Availability confirmed')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  confirm(@Body() dto: CheckAvailabilityDto): Promise<AvailabilityAndPrice> {
    return this.availability.confirm(dto);
  }
}
