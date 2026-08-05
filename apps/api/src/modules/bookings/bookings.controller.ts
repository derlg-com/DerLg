import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingView } from './interfaces/booking.interface';

@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  /** Takes a 15-minute hold on everything in the itinerary. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Booking held')
  // Each call locks catalogue rows, so it is deliberately tighter than reads.
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBookingDto,
  ): Promise<BookingView> {
    return this.bookings.create(
      user.id,
      { name: dto.contactName, email: dto.contactEmail },
      dto,
    );
  }

  @Get()
  @ResponseMessage('Bookings retrieved')
  list(@CurrentUser() user: AuthenticatedUser): Promise<BookingView[]> {
    return this.bookings.findAll(user.id);
  }

  @Get(':id')
  @ResponseMessage('Booking retrieved')
  detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BookingView> {
    return this.bookings.findOne(user.id, id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Booking cancelled')
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BookingView> {
    return this.bookings.cancel(user.id, id);
  }
}
