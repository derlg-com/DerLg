import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { BookingsController } from './bookings.controller';
import {
  CommitBookingUseCase,
  ListBookingsUseCase,
  GetBookingDetailUseCase,
} from './use-cases';
import {
  SetHoldUtil,
  ReleaseHoldUtil,
  IdempotencyUtil,
  CheckRoomAvailabilityUtil,
} from './utils';

/**
 * BookingsModule — owns the unified `/v1/bookings/*` surface and the
 * shared atomic CommitBookingUseCase. Future M4 sub-method modules
 * (transportation, hotel-room, guide, single-trip) will import this
 * module and delegate creation to CommitBookingUseCase.
 *
 * EventEmitterModule.forRoot() is registered at the app root, so
 * EventEmitter2 is injectable here without re-importing.
 */
@Module({
  imports: [PrismaModule, RedisModule, ConfigModule],
  controllers: [BookingsController],
  providers: [
    CommitBookingUseCase,
    ListBookingsUseCase,
    GetBookingDetailUseCase,
    SetHoldUtil,
    ReleaseHoldUtil,
    IdempotencyUtil,
    CheckRoomAvailabilityUtil,
  ],
  exports: [CommitBookingUseCase],
})
export class BookingsModule {}
