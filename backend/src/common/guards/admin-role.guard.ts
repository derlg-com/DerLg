import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '@prisma/client';

import { PrismaService } from '../../modules/prisma/prisma.service';
import { RedisService } from '../../modules/redis/redis.service';
import { ADMIN_ROLES_KEY } from '../decorators/admin-roles.decorator';

import type { JwtPayload } from '../../modules/auth/strategies/jwt.strategy';

/** Shape cached in Redis; mirrors the columns the guard needs from admin_users. */
interface CachedAdminPermissions {
  adminRole: AdminRole;
  permissions: Record<string, boolean> | null;
  isActive: boolean;
}

/** Resolved admin context attached to the request for downstream handlers. */
export interface RequestAdminUser {
  userId: string;
  adminRole: AdminRole;
  permissions: Record<string, boolean> | null;
}

export const ADMIN_PERMISSIONS_CACHE_PREFIX = 'admin:permissions:';

/** Cache key for a user's admin grant. Exported so services can invalidate it. */
export function adminPermissionsCacheKey(userId: string): string {
  return `${ADMIN_PERMISSIONS_CACHE_PREFIX}${userId}`;
}

/**
 * Authorises admin routes against the `admin_users` table.
 *
 * Runs after the global `JwtAuthGuard`, so `request.user` is already the decoded
 * token. Routes without `@AdminRoles()` are passed through untouched — this
 * guard is opt-in per route, exactly like the existing `RolesGuard`.
 *
 * The grant is cached in Redis for five minutes to keep the common path off the
 * database. Cache failures are logged and fall through to a live query rather
 * than denying access, since Redis being down is an availability problem, not an
 * authorisation one. A *missing or inactive* grant always denies.
 */
@Injectable()
export class AdminRoleGuard implements CanActivate {
  private readonly logger = new Logger(AdminRoleGuard.name);
  private readonly CACHE_TTL_SECONDS = 5 * 60;

  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<AdminRole[]>(
      ADMIN_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Not an admin-gated route.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: JwtPayload;
      adminUser?: RequestAdminUser;
    }>();
    const user = request.user;

    if (!user?.sub) {
      throw new ForbiddenException('Access denied: user not authenticated');
    }

    const grant = await this.resolveGrant(user.sub);

    if (!grant.isActive) {
      throw new ForbiddenException(
        'Access denied: admin account is deactivated',
      );
    }

    // SUPER_ADMIN is unconditionally allowed everywhere.
    if (grant.adminRole !== AdminRole.SUPER_ADMIN) {
      if (!requiredRoles.includes(grant.adminRole)) {
        throw new ForbiddenException(
          `Access denied: requires one of [${requiredRoles.join(', ')}], but you have ${grant.adminRole}`,
        );
      }
    }

    request.adminUser = {
      userId: user.sub,
      adminRole: grant.adminRole,
      permissions: grant.permissions,
    };

    return true;
  }

  /** Reads the grant from cache, falling back to the database on a miss. */
  private async resolveGrant(userId: string): Promise<CachedAdminPermissions> {
    const cacheKey = adminPermissionsCacheKey(userId);

    try {
      const raw = await this.redis.get(cacheKey);
      if (raw) {
        return JSON.parse(raw) as CachedAdminPermissions;
      }
    } catch (error) {
      this.logger.warn('Admin permissions cache read failed', {
        userId,
        error: (error as Error).message,
      });
    }

    const adminUser = await this.prisma.adminUser.findUnique({
      where: { userId },
      select: { adminRole: true, permissions: true, isActive: true },
    });

    if (!adminUser) {
      throw new ForbiddenException('Access denied: not an admin user');
    }

    const grant: CachedAdminPermissions = {
      adminRole: adminUser.adminRole,
      permissions:
        (adminUser.permissions as Record<string, boolean> | null) ?? null,
      isActive: adminUser.isActive,
    };

    try {
      await this.redis.setex(
        cacheKey,
        this.CACHE_TTL_SECONDS,
        JSON.stringify(grant),
      );
    } catch (error) {
      this.logger.warn('Admin permissions cache write failed', {
        userId,
        error: (error as Error).message,
      });
    }

    return grant;
  }
}
