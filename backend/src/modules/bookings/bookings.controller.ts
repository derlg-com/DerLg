import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ListBookingsUseCase, GetBookingDetailUseCase } from './use-cases';
import { ListBookingsQueryDto } from './dto';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly listBookings: ListBookingsUseCase,
    private readonly getBookingDetail: GetBookingDetailUseCase,
  ) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: ListBookingsQueryDto) {
    return this.listBookings.execute(user, query);
  }

  @Get(':id')
  detail(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.getBookingDetail.execute(user, id);
  }
}
