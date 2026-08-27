import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RedisService } from '../../redis/redis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole, AuditEventType, Prisma, AdminRole } from '@prisma/client';

/**
 * Keeps `users.role` consistent with `admin_users.admin_role`.
 *
 * Both exist because the JWT carries the coarse `users.role` claim (checked by
 * RolesGuard without a database hit) while the fine-grained grant lives in
 * `admin_users` (checked by AdminRoleGuard). The previous code wrote a blanket
 * `'admin'` for every admin, which made the JWT claim useless for telling an
 * OPERATIONS_MANAGER apart from a SUPPORT_AGENT.
 */
const ADMIN_ROLE_TO_USER_ROLE: Record<AdminRole, UserRole> = {
  [AdminRole.SUPER_ADMIN]: UserRole.super_admin,
  [AdminRole.OPERATIONS_MANAGER]: UserRole.operations_manager,
  [AdminRole.FLEET_MANAGER]: UserRole.fleet_manager,
  [AdminRole.SUPPORT_AGENT]: UserRole.support_agent,
};

@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);
  private readonly CACHE_TTL_SECONDS = 5 * 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getAllAdminUsers() {
    const adminUsers = await this.prisma.adminUser.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const userIds = adminUsers.map((au) => au.userId);
    const users =
      userIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: {
              id: true,
              email: true,
              fullName: true,
              phone: true,
              role: true,
              createdAt: true,
            },
          })
        : [];

    const userMap = new Map(users.map((u) => [u.id, u]));

    return adminUsers.map((au) => {
      const user = userMap.get(au.userId);
      return {
        id: au.id,
        userId: au.userId,
        email: user?.email || null,
        fullName: user?.fullName || null,
        phone: user?.phone || null,
        role: user?.role || null,
        adminRole: au.adminRole,
        permissions: au.permissions,
        isActive: au.isActive,
        createdAt: au.createdAt,
        userCreatedAt: user?.createdAt || null,
      };
    });
  }

  async createAdminUser(dto: {
    email: string;
    fullName?: string;
    phone?: string;
    adminRole: AdminRole;
    permissions?: Record<string, boolean>;
  }) {
    const existingUser = await this.prisma.user.findFirst({
      where: { email: { equals: dto.email, mode: 'insensitive' } },
    });

    let userId: string;

    if (existingUser) {
      // If user exists, check if already an admin
      const existingAdmin = await this.prisma.adminUser.findUnique({
        where: { userId: existingUser.id },
      });

      if (existingAdmin) {
        throw new ConflictException(
          `User with email '${dto.email}' is already an admin`,
        );
      }

      // Update existing user role to admin
      await this.prisma.user.update({
        where: { id: existingUser.id },
        data: { role: ADMIN_ROLE_TO_USER_ROLE[dto.adminRole] },
      });

      userId = existingUser.id;
    } else {
      // Create new user
      const newUser = await this.prisma.user.create({
        data: {
          id: randomUUID(),
          supabaseUid: randomUUID(),
          email: dto.email.toLowerCase(),
          fullName: dto.fullName || null,
          phone: dto.phone || null,
          role: ADMIN_ROLE_TO_USER_ROLE[dto.adminRole],
        },
      });
      userId = newUser.id;
    }

    const adminUser = await this.prisma.adminUser.create({
      data: {
        userId,
        adminRole: dto.adminRole,
        permissions: dto.permissions || {},
      },
    });

    // Cache admin permissions
    await this.cacheAdminPermissions(userId, dto.adminRole, dto.permissions);

    return {
      id: adminUser.id,
      userId: adminUser.userId,
      email: dto.email.toLowerCase(),
      fullName: dto.fullName || null,
      phone: dto.phone || null,
      adminRole: adminUser.adminRole,
      permissions: adminUser.permissions,
      isActive: adminUser.isActive,
      createdAt: adminUser.createdAt,
    };
  }

  async updateAdminUser(
    id: string,
    dto: {
      adminRole?: AdminRole;
      permissions?: Record<string, boolean>;
      isActive?: boolean;
    },
  ) {
    const existing = await this.prisma.adminUser.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Admin user with id ${id} not found`);
    }

    const adminUser = await this.prisma.adminUser.update({
      where: { id },
      data: {
        adminRole: dto.adminRole,
        permissions: dto.permissions,
        isActive: dto.isActive,
      },
    });

    // Invalidate and refresh cache
    await this.redis.getClient().del(`admin:permissions:${existing.userId}`);

    if (dto.adminRole && dto.isActive !== false) {
      await this.cacheAdminPermissions(
        existing.userId,
        dto.adminRole,
        dto.permissions ?? (existing.permissions as Record<string, boolean>),
      );
    }

    return adminUser;
  }

  async deactivateAdminUser(id: string) {
    const existing = await this.prisma.adminUser.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Admin user with id ${id} not found`);
    }

    const adminUser = await this.prisma.adminUser.update({
      where: { id },
      data: {
        isActive: false,
      },
    });

    // Revoke all refresh tokens for this user
    await this.prisma.refreshToken.updateMany({
      where: { userId: existing.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Clear cache
    await this.redis.getClient().del(`admin:permissions:${existing.userId}`);

    return adminUser;
  }

  async createAuditLog(params: {
    userId?: string;
    eventType: AuditEventType;
    entityType: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: params.userId || null,
          eventType: params.eventType,
          entityType: params.entityType,
          entityId: params.entityId || null,
          metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Audit log creation failed: ${(error as Error).message}`,
      );
    }
  }

  private async cacheAdminPermissions(
    userId: string,
    adminRole: AdminRole,
    permissions: Record<string, boolean> | undefined,
  ): Promise<void> {
    const cacheKey = `admin:permissions:${userId}`;
    const cacheData = {
      adminRole,
      permissions: permissions || null,
      isActive: true,
    };

    try {
      await this.redis
        .getClient()
        .setex(cacheKey, this.CACHE_TTL_SECONDS, JSON.stringify(cacheData));
    } catch (error) {
      this.logger.warn(`Redis cache write failed: ${(error as Error).message}`);
    }
  }
}
