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
    SetHoldUtil,
    ReleaseHoldUtil,
    IdempotencyUtil,
    CheckRoomAvailabilityUtil,
  ],
  exports: [CommitBookingUseCase],
})
export class BookingsModule {}
