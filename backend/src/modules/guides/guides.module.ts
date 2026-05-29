import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { CommonModule } from '../../common/common.module';
import { BookingsModule } from '../bookings/bookings.module';
import { GuidesController } from './guides.controller';
import {
  ListGuidesUseCase,
  GetGuideDetailUseCase,
  GetGuideAvailabilityUseCase,
  BookGuideUseCase,
} from './use-cases';

@Module({
  imports: [PrismaModule, RedisModule, CommonModule, BookingsModule],
  controllers: [GuidesController],
  providers: [
    ListGuidesUseCase,
    GetGuideDetailUseCase,
    GetGuideAvailabilityUseCase,
    BookGuideUseCase,
  ],
})
export class GuidesModule {}
