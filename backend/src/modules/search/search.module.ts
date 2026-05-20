import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { CommonModule } from '../../common/common.module';
import { SearchController } from './search.controller';
import { GlobalSearchUseCase } from './use-cases';

@Module({
  imports: [PrismaModule, RedisModule, CommonModule],
  controllers: [SearchController],
  providers: [GlobalSearchUseCase],
})
export class SearchModule {}
