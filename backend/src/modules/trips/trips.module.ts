import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { CommonModule } from '../../common/common.module';
import { BookingsModule } from '../bookings/bookings.module';
import { TripsController } from './trips.controller';
import {
  ListTripsUseCase,
  GetTripDetailUseCase,
  GetRelatedTripsUseCase,
  GetTripShareUrlUseCase,
  BookSingleTripUseCase,
} from './use-cases';

@Module({
  imports: [PrismaModule, RedisModule, CommonModule, BookingsModule],
  controllers: [TripsController],
  providers: [
    ListTripsUseCase,
    GetTripDetailUseCase,
    GetRelatedTripsUseCase,
    GetTripShareUrlUseCase,
    BookSingleTripUseCase,
  ],
})
export class TripsModule {}
