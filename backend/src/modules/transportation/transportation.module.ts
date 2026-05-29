import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { CommonModule } from '../../common/common.module';
import { BookingsModule } from '../bookings/bookings.module';
import { TransportationController } from './transportation.controller';
import {
  ListVehiclesUseCase,
  GetVehicleDetailUseCase,
  GetVehicleAvailabilityUseCase,
  BookTransportationUseCase,
} from './use-cases';

@Module({
  imports: [PrismaModule, RedisModule, CommonModule, BookingsModule],
  controllers: [TransportationController],
  providers: [
    ListVehiclesUseCase,
    GetVehicleDetailUseCase,
    GetVehicleAvailabilityUseCase,
    BookTransportationUseCase,
  ],
})
export class TransportationModule {}
