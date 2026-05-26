import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { TransformInterceptor } from './interceptors/transform.interceptor';
import { CachedService } from './cache/cached.service';
import { RedisModule } from '../modules/redis/redis.module';

export * from './i18n';

/**
 * Registers global guards/interceptors and provides shared catalog services.
 * Import once in AppModule.
 */
@Module({
  imports: [RedisModule],
  providers: [
    CachedService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
  exports: [CachedService],
})
export class CommonModule {}
