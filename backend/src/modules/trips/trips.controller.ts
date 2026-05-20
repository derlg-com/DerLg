import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { parseAcceptLanguage } from '../../common/i18n';
import {
  ListTripsUseCase,
  GetTripDetailUseCase,
  GetRelatedTripsUseCase,
  GetTripShareUrlUseCase,
} from './use-cases';
import { ListTripsDto } from './dto';

@Controller('trips')
export class TripsController {
  constructor(
    private readonly listTrips: ListTripsUseCase,
    private readonly getTripDetail: GetTripDetailUseCase,
    private readonly getRelatedTrips: GetRelatedTripsUseCase,
    private readonly getTripShareUrl: GetTripShareUrlUseCase,
  ) {}

  @Public()
  @Get()
  list(@Query() query: ListTripsDto, @Req() req: Request) {
    return this.listTrips.execute(query, parseAcceptLanguage(req));
  }

  @Public()
  @Get(':id')
  detail(@Param('id') id: string, @Req() req: Request) {
    return this.getTripDetail.execute(id, parseAcceptLanguage(req));
  }

  @Public()
  @Get(':id/related')
  related(@Param('id') id: string, @Req() req: Request) {
    return this.getRelatedTrips.execute(id, parseAcceptLanguage(req));
  }

  @Public()
  @Get(':id/share')
  share(@Param('id') id: string) {
    return this.getTripShareUrl.execute(id);
  }
}
