import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { CommonModule } from '../../common/common.module';
import { PlacesController } from './places.controller';
import {
  ListPlacesUseCase,
  GetPlaceDetailUseCase,
  GetRelatedPlacesUseCase,
  GetNearbyTripsUseCase,
  GetNearbyPlacesUseCase,
} from './use-cases';

@Module({
  imports: [PrismaModule, RedisModule, CommonModule],
  controllers: [PlacesController],
  providers: [
    ListPlacesUseCase,
    GetPlaceDetailUseCase,
    GetRelatedPlacesUseCase,
    GetNearbyTripsUseCase,
    GetNearbyPlacesUseCase,
  ],
})
export class PlacesModule {}
