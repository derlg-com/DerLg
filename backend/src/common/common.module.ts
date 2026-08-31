import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { AdminRoleGuard } from './guards/admin-role.guard';
import { TransformInterceptor } from './interceptors/transform.interceptor';
import { CachedService } from './cache/cached.service';
import { CacheInvalidationService } from './cache/cache-invalidation.service';
import { RedisModule } from '../modules/redis/redis.module';
import { PrismaModule } from '../modules/prisma/prisma.module';

export * from './i18n';

/**
 * Registers global guards/interceptors and provides shared catalog services.
 * Import once in AppModule.
 */
@Module({
  imports: [RedisModule, PrismaModule],
  providers: [
    CachedService,
    CacheInvalidationService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    // Third layer: only acts on routes carrying @AdminRoles(); everything else
    // passes straight through.
    {
      provide: APP_GUARD,
      useClass: AdminRoleGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
  exports: [CachedService, CacheInvalidationService],
})
export class CommonModule {}
