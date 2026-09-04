import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerStorage } from '@nestjs/throttler';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { AdminRoleGuard } from './guards/admin-role.guard';
import { CustomThrottlerGuard } from './guards/throttler.guard';
import { TransformInterceptor } from './interceptors/transform.interceptor';
import { CachedService } from './cache/cached.service';
import { CacheInvalidationService } from './cache/cache-invalidation.service';
import { RedisThrottlerStorage } from './throttler/redis-throttler.storage';
import { RedisModule } from '../modules/redis/redis.module';
import { PrismaModule } from '../modules/prisma/prisma.module';

export * from './i18n';

/**
 * Registers global guards/interceptors and provides shared catalog services.
 * Import once in AppModule.
 *
 * Guard order matters — `APP_GUARD` providers run in declaration order and the
 * first rejection short-circuits the rest:
 *
 *   1. `CustomThrottlerGuard` — counts every request, including ones that go on
 *      to fail auth. Placed after `JwtAuthGuard` it would never see a
 *      credential-stuffing run, because those requests never reach it.
 *   2. `JwtAuthGuard`         — authentication (opt out with `@Public()`).
 *   3. `RolesGuard`           — coarse role claim from the JWT.
 *   4. `AdminRoleGuard`       — admin grant from `admin_users`; no-ops on routes
 *                               without `@AdminRoles()`.
 */
@Module({
  imports: [RedisModule, PrismaModule],
  providers: [
    CachedService,
    CacheInvalidationService,
    // Replaces the library's in-process Map so limits are shared across every
    // application instance instead of being per-process.
    { provide: ThrottlerStorage, useClass: RedisThrottlerStorage },
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    // Fourth layer: only acts on routes carrying @AdminRoles(); everything else
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
