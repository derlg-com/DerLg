import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { CommonModule } from '../../common/common.module';
import { BookingsModule } from '../bookings/bookings.module';
import { HotelsController } from './hotels.controller';
import {
  ListHotelsUseCase,
  GetHotelDetailUseCase,
  GetHotelRoomsUseCase,
  BookHotelRoomUseCase,
} from './use-cases';

@Module({
  imports: [PrismaModule, RedisModule, CommonModule, BookingsModule],
  controllers: [HotelsController],
  providers: [
    ListHotelsUseCase,
    GetHotelDetailUseCase,
    GetHotelRoomsUseCase,
    BookHotelRoomUseCase,
  ],
})
export class HotelsModule {}
