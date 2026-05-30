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
  ListHotelsUseCase,
  GetHotelDetailUseCase,
  GetHotelRoomsUseCase,
  BookHotelRoomUseCase,
} from './use-cases';
import {
  ListHotelsDto,
  RoomAvailabilityQueryDto,
  BookHotelRoomDto,
} from './dto';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@Controller('hotels')
export class HotelsController {
  constructor(
    private readonly listHotels: ListHotelsUseCase,
    private readonly getHotelDetail: GetHotelDetailUseCase,
    private readonly getHotelRooms: GetHotelRoomsUseCase,
    private readonly bookHotelRoom: BookHotelRoomUseCase,
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

  @Post(':hotelId/bookings')
  book(
    @CurrentUser() user: JwtPayload,
    @Param('hotelId') hotelId: string,
    @Body() dto: BookHotelRoomDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.bookHotelRoom.execute(user, hotelId, dto, idempotencyKey);
  }
}
