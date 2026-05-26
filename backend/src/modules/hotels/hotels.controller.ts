import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { parseAcceptLanguage } from '../../common/i18n';
import {
  ListHotelsUseCase,
  GetHotelDetailUseCase,
  GetHotelRoomsUseCase,
} from './use-cases';
import { ListHotelsDto, RoomAvailabilityQueryDto } from './dto';

@Controller('hotels')
export class HotelsController {
  constructor(
    private readonly listHotels: ListHotelsUseCase,
    private readonly getHotelDetail: GetHotelDetailUseCase,
    private readonly getHotelRooms: GetHotelRoomsUseCase,
  ) {}

  @Public()
  @Get()
  list(@Query() query: ListHotelsDto, @Req() req: Request) {
    return this.listHotels.execute(query, parseAcceptLanguage(req));
  }

  @Public()
  @Get(':id')
  detail(@Param('id') id: string, @Req() req: Request) {
    return this.getHotelDetail.execute(id, parseAcceptLanguage(req));
  }

  @Public()
  @Get(':id/rooms')
  rooms(@Param('id') id: string, @Query() query: RoomAvailabilityQueryDto) {
    return this.getHotelRooms.execute(id, query);
  }
}
