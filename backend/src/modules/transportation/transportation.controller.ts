import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { parseAcceptLanguage } from '../../common/i18n';
import {
  ListVehiclesUseCase,
  GetVehicleDetailUseCase,
  GetVehicleAvailabilityUseCase,
} from './use-cases';
import { ListVehiclesDto, AvailabilityQueryDto } from './dto';

@Controller('transportation/vehicles')
export class TransportationController {
  constructor(
    private readonly listVehicles: ListVehiclesUseCase,
    private readonly getVehicleDetail: GetVehicleDetailUseCase,
    private readonly getVehicleAvailability: GetVehicleAvailabilityUseCase,
  ) {}

  @Public()
  @Get()
  list(@Query() query: ListVehiclesDto) {
    return this.listVehicles.execute(query);
  }

  @Public()
  @Get(':id')
  detail(@Param('id') id: string, @Req() req: Request) {
    return this.getVehicleDetail.execute(id, parseAcceptLanguage(req));
  }

  @Public()
  @Get(':id/availability')
  availability(@Param('id') id: string, @Query() query: AvailabilityQueryDto) {
    return this.getVehicleAvailability.execute(id, query);
  }
}
