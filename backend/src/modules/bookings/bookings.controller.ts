import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  ListBookingsUseCase,
  GetBookingDetailUseCase,
  UpdateBookingUseCase,
  CancelBookingUseCase,
  GetBookingQrUseCase,
  GetBookingIcalUseCase,
  TemplateBookingUseCase,
} from './use-cases';
import {
  ListBookingsQueryDto,
  UpdateBookingDto,
  CancelBookingDto,
  CreateTemplateBookingDto,
} from './dto';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly listBookings: ListBookingsUseCase,
    private readonly getBookingDetail: GetBookingDetailUseCase,
    private readonly updateBooking: UpdateBookingUseCase,
    private readonly cancelBooking: CancelBookingUseCase,
    private readonly getBookingQr: GetBookingQrUseCase,
    private readonly getBookingIcal: GetBookingIcalUseCase,
    private readonly templateBooking: TemplateBookingUseCase,
  ) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: ListBookingsQueryDto) {
    return this.listBookings.execute(user, query);
  }

  @Post('template')
  template(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTemplateBookingDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.templateBooking.execute(user, dto, idempotencyKey);
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

  @Get(':id/qr')
  qr(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.getBookingQr.execute(user, id);
  }

  @Get(':id/ical')
  async ical(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { filename, body } = await this.getBookingIcal.execute(user, id);
    res
      .header('Content-Type', 'text/calendar; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(body);
  }
}
