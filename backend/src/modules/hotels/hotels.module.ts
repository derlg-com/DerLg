import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { CommonModule } from '../../common/common.module';
import { HotelsController } from './hotels.controller';
import {
  ListHotelsUseCase,
  GetHotelDetailUseCase,
  GetHotelRoomsUseCase,
} from './use-cases';

@Module({
  imports: [PrismaModule, RedisModule, CommonModule],
  controllers: [HotelsController],
  providers: [ListHotelsUseCase, GetHotelDetailUseCase, GetHotelRoomsUseCase],
})
export class HotelsModule {}
