import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { parseAcceptLanguage } from '../../common/i18n';
import {
  ListVehiclesUseCase,
  GetVehicleDetailUseCase,
  GetVehicleAvailabilityUseCase,
  BookTransportationUseCase,
} from './use-cases';
import {
  ListVehiclesDto,
  AvailabilityQueryDto,
  BookTransportationDto,
} from './dto';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@Controller('transportation')
export class TransportationController {
  constructor(
    private readonly listVehicles: ListVehiclesUseCase,
    private readonly getVehicleDetail: GetVehicleDetailUseCase,
    private readonly getVehicleAvailability: GetVehicleAvailabilityUseCase,
    private readonly bookTransportation: BookTransportationUseCase,
  ) {}

  @Public()
  @Get('vehicles')
  list(@Query() query: ListVehiclesDto) {
    return this.listVehicles.execute(query);
  }

  @Public()
  @Get('vehicles/:id')
  detail(@Param('id') id: string, @Req() req: Request) {
    return this.getVehicleDetail.execute(id, parseAcceptLanguage(req));
  }

  @Public()
  @Get('vehicles/:id/availability')
  availability(@Param('id') id: string, @Query() query: AvailabilityQueryDto) {
    return this.getVehicleAvailability.execute(id, query);
  }

  @Post('bookings')
  book(
    @CurrentUser() user: JwtPayload,
    @Body() dto: BookTransportationDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.bookTransportation.execute(user, dto, idempotencyKey);
  }
}
