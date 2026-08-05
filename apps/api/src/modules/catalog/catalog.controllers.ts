import { Controller, Get, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Paginated } from '../../common/interfaces/api-response.interface';
import { CatalogService } from './catalog.service';
import {
  ListGuidesQueryDto,
  ListHotelsQueryDto,
  ListPlacesQueryDto,
  ListTransportsQueryDto,
} from './dto/list-resources.query.dto';
import {
  CityRecord,
  GuideRecord,
  HotelRecord,
  PlaceDetail,
  PlaceSummary,
  TransportRecord,
} from './interfaces/catalog.interface';

@Controller('places')
@Throttle({ default: { limit: 120, ttl: 60_000 } })
export class PlacesController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ResponseMessage('Places retrieved')
  list(@Query() query: ListPlacesQueryDto): Promise<Paginated<PlaceSummary>> {
    return this.catalog.listPlaces(query);
  }

  @Get(':slug')
  @ResponseMessage('Place retrieved')
  detail(@Param('slug') slug: string): Promise<PlaceDetail> {
    return this.catalog.getPlaceBySlug(slug);
  }
}

@Controller('hotels')
@Throttle({ default: { limit: 120, ttl: 60_000 } })
export class HotelsController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ResponseMessage('Hotels retrieved')
  list(@Query() query: ListHotelsQueryDto): Promise<Paginated<HotelRecord>> {
    return this.catalog.listHotels(query);
  }

  @Get(':slug')
  @ResponseMessage('Hotel retrieved')
  detail(@Param('slug') slug: string): Promise<HotelRecord> {
    return this.catalog.getHotelBySlug(slug);
  }
}

@Controller('transports')
@Throttle({ default: { limit: 120, ttl: 60_000 } })
export class TransportsController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ResponseMessage('Transport routes retrieved')
  list(@Query() query: ListTransportsQueryDto): Promise<Paginated<TransportRecord>> {
    return this.catalog.listTransports(query);
  }

  @Get(':slug')
  @ResponseMessage('Transport route retrieved')
  detail(@Param('slug') slug: string): Promise<TransportRecord> {
    return this.catalog.getTransportBySlug(slug);
  }
}

@Controller('guides')
@Throttle({ default: { limit: 120, ttl: 60_000 } })
export class GuidesController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ResponseMessage('Guides retrieved')
  list(@Query() query: ListGuidesQueryDto): Promise<Paginated<GuideRecord>> {
    return this.catalog.listGuides(query);
  }

  @Get(':slug')
  @ResponseMessage('Guide retrieved')
  detail(@Param('slug') slug: string): Promise<GuideRecord> {
    return this.catalog.getGuideBySlug(slug);
  }
}

@Controller('cities')
@Throttle({ default: { limit: 120, ttl: 60_000 } })
export class CitiesController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ResponseMessage('Cities retrieved')
  list(): Promise<CityRecord[]> {
    return this.catalog.listCities();
  }
}
