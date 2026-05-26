import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { CommonModule } from '../../common/common.module';
import { TransportationController } from './transportation.controller';
import {
  ListVehiclesUseCase,
  GetVehicleDetailUseCase,
  GetVehicleAvailabilityUseCase,
} from './use-cases';

@Module({
  imports: [PrismaModule, RedisModule, CommonModule],
  controllers: [TransportationController],
  providers: [
    ListVehiclesUseCase,
    GetVehicleDetailUseCase,
    GetVehicleAvailabilityUseCase,
  ],
})
export class TransportationModule {}
