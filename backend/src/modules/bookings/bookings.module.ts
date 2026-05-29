import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { BookingsController } from './bookings.controller';
import {
  CommitBookingUseCase,
  ListBookingsUseCase,
  GetBookingDetailUseCase,
  UpdateBookingUseCase,
  CancelBookingUseCase,
  GetBookingQrUseCase,
  GetBookingIcalUseCase,
  ExpireHoldUseCase,
  TemplateBookingUseCase,
} from './use-cases';
import {
  SetHoldUtil,
  ReleaseHoldUtil,
  IdempotencyUtil,
  CheckRoomAvailabilityUtil,
} from './utils';

@Module({
  imports: [PrismaModule, RedisModule, ConfigModule],
  controllers: [BookingsController],
  providers: [
    CommitBookingUseCase,
    ListBookingsUseCase,
    GetBookingDetailUseCase,
    UpdateBookingUseCase,
    CancelBookingUseCase,
    GetBookingQrUseCase,
    GetBookingIcalUseCase,
    ExpireHoldUseCase,
    TemplateBookingUseCase,
    SetHoldUtil,
    ReleaseHoldUtil,
    IdempotencyUtil,
    CheckRoomAvailabilityUtil,
  ],
  // Exported so future M4 sub-method modules can inject CommitBookingUseCase
  // and Phase 8's BookingCleanupJob can inject ExpireHoldUseCase.
  exports: [CommitBookingUseCase, ExpireHoldUseCase],
})
export class BookingsModule {}
