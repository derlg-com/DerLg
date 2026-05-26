import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { parseAcceptLanguage } from '../../common/i18n';
import {
  ListPlacesUseCase,
  GetPlaceDetailUseCase,
  GetRelatedPlacesUseCase,
  GetNearbyTripsUseCase,
  GetNearbyPlacesUseCase,
} from './use-cases';
import { ListPlacesDto, NearbyQueryDto } from './dto';

@Controller('places')
export class PlacesController {
  constructor(
    private readonly listPlaces: ListPlacesUseCase,
    private readonly getPlaceDetail: GetPlaceDetailUseCase,
    private readonly getRelatedPlaces: GetRelatedPlacesUseCase,
    private readonly getNearbyTrips: GetNearbyTripsUseCase,
    private readonly getNearbyPlaces: GetNearbyPlacesUseCase,
  ) {}

  @Public()
  @Get()
  list(@Query() query: ListPlacesDto, @Req() req: Request) {
    return this.listPlaces.execute(query, parseAcceptLanguage(req));
  }

  @Public()
  @Get(':id')
  detail(@Param('id') id: string, @Req() req: Request) {
    return this.getPlaceDetail.execute(id, parseAcceptLanguage(req));
  }

  @Public()
  @Get(':id/related')
  related(@Param('id') id: string, @Req() req: Request) {
    return this.getRelatedPlaces.execute(id, parseAcceptLanguage(req));
  }

  @Public()
  @Get(':id/nearby-trips')
  nearbyTrips(
    @Param('id') id: string,
    @Query() query: NearbyQueryDto,
    @Req() req: Request,
  ) {
    return this.getNearbyTrips.execute(
      id,
      query.radiusKm ?? 20,
      parseAcceptLanguage(req),
    );
  }

  @Public()
  @Get(':id/nearby-places')
  nearbyPlaces(
    @Param('id') id: string,
    @Query() query: NearbyQueryDto,
    @Req() req: Request,
  ) {
    return this.getNearbyPlaces.execute(
      id,
      query.radiusKm ?? 20,
      parseAcceptLanguage(req),
    );
  }
}
