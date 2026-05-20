import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { CommonModule } from '../../common/common.module';
import { GuidesController } from './guides.controller';
import {
  ListGuidesUseCase,
  GetGuideDetailUseCase,
  GetGuideAvailabilityUseCase,
} from './use-cases';

@Module({
  imports: [PrismaModule, RedisModule, CommonModule],
  controllers: [GuidesController],
  providers: [
    ListGuidesUseCase,
    GetGuideDetailUseCase,
    GetGuideAvailabilityUseCase,
  ],
})
export class GuidesModule {}
