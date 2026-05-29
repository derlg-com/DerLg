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
  ListTripsUseCase,
  GetTripDetailUseCase,
  GetRelatedTripsUseCase,
  GetTripShareUrlUseCase,
  BookSingleTripUseCase,
} from './use-cases';
import { ListTripsDto, BookSingleTripDto } from './dto';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@Controller('trips')
export class TripsController {
  constructor(
    private readonly listTrips: ListTripsUseCase,
    private readonly getTripDetail: GetTripDetailUseCase,
    private readonly getRelatedTrips: GetRelatedTripsUseCase,
    private readonly getTripShareUrl: GetTripShareUrlUseCase,
    private readonly bookSingleTrip: BookSingleTripUseCase,
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

  @Post(':tripId/bookings')
  book(
    @CurrentUser() user: JwtPayload,
    @Param('tripId') tripId: string,
    @Body() dto: BookSingleTripDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.bookSingleTrip.execute(user, tripId, dto, idempotencyKey);
  }
}
