import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { CommonModule } from '../../common/common.module';
import { TripsController } from './trips.controller';
import {
  ListTripsUseCase,
  GetTripDetailUseCase,
  GetRelatedTripsUseCase,
  GetTripShareUrlUseCase,
} from './use-cases';

@Module({
  imports: [PrismaModule, RedisModule, CommonModule],
  controllers: [TripsController],
  providers: [
    ListTripsUseCase,
    GetTripDetailUseCase,
    GetRelatedTripsUseCase,
    GetTripShareUrlUseCase,
  ],
})
export class TripsModule {}
