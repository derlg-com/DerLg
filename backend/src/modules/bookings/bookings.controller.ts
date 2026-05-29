import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  ListBookingsUseCase,
  GetBookingDetailUseCase,
  UpdateBookingUseCase,
  CancelBookingUseCase,
} from './use-cases';
import {
  ListBookingsQueryDto,
  UpdateBookingDto,
  CancelBookingDto,
} from './dto';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly listBookings: ListBookingsUseCase,
    private readonly getBookingDetail: GetBookingDetailUseCase,
    private readonly updateBooking: UpdateBookingUseCase,
    private readonly cancelBooking: CancelBookingUseCase,
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

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBookingDto,
  ) {
    return this.updateBooking.execute(user, id, dto);
  }

  @Post(':id/cancel')
  cancel(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.cancelBooking.execute(user, id, dto);
  }
}
