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
import { hashPassword } from '../../auth/utils/hash-password.util';

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
    password?: string;
  }) {
    const existingUser = await this.prisma.user.findFirst({
      where: { email: { equals: dto.email, mode: 'insensitive' } },
    });

    // No password means no usable login, so the grant is created inactive rather
    // than appearing ready to use. The caller is told which happened.
    const hasPassword = !!dto.password;
    const passwordHash = dto.password
      ? await hashPassword(dto.password)
      : undefined;

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
        data: {
          role: ADMIN_ROLE_TO_USER_ROLE[dto.adminRole],
          // Never blank an existing password: this user may already sign in as a
          // customer, and overwriting it would lock them out of that account.
          ...(passwordHash ? { passwordHash } : {}),
        },
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
          passwordHash: passwordHash ?? null,
        },
      });
      userId = newUser.id;
    }

    // An existing user already has a working password even if none was supplied
    // here, so only a brand-new account without one is created inactive.
    const canSignIn = hasPassword || !!existingUser?.passwordHash;

    const adminUser = await this.prisma.adminUser.create({
      data: {
        userId,
        adminRole: dto.adminRole,
        permissions: dto.permissions || {},
        isActive: canSignIn,
      },
    });

    // Only cache a grant that can actually be exercised.
    if (canSignIn) {
      await this.cacheAdminPermissions(userId, dto.adminRole, dto.permissions);
    }

    return {
      id: adminUser.id,
      userId: adminUser.userId,
      email: dto.email.toLowerCase(),
      fullName: dto.fullName || null,
      phone: dto.phone || null,
      adminRole: adminUser.adminRole,
      permissions: adminUser.permissions,
      isActive: adminUser.isActive,
      canSignIn,
      createdAt: adminUser.createdAt,
    };
  }

  async getAdminUserById(id: string) {
    const adminUser = await this.prisma.adminUser.findUnique({
      where: { id },
    });
    if (!adminUser) {
      throw new NotFoundException(`Admin user with id ${id} not found`);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: adminUser.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        status: true,
        // Surfaced as a boolean, never the hash itself.
        passwordHash: true,
        createdAt: true,
      },
    });

    return {
      id: adminUser.id,
      userId: adminUser.userId,
      email: user?.email ?? null,
      fullName: user?.fullName ?? null,
      phone: user?.phone ?? null,
      role: user?.role ?? null,
      status: user?.status ?? null,
      adminRole: adminUser.adminRole,
      permissions: adminUser.permissions,
      isActive: adminUser.isActive,
      canSignIn: !!user?.passwordHash,
      createdAt: adminUser.createdAt,
      userCreatedAt: user?.createdAt ?? null,
    };
  }

  /**
   * Sets a new password and terminates existing sessions.
   *
   * A reset is usually a response to a suspected compromise, so leaving the old
   * sessions alive would defeat the point.
   */
  async resetAdminPassword(id: string, password: string) {
    const adminUser = await this.prisma.adminUser.findUnique({
      where: { id },
      select: { id: true, userId: true, adminRole: true, permissions: true },
    });
    if (!adminUser) {
      throw new NotFoundException(`Admin user with id ${id} not found`);
    }

    const passwordHash = await hashPassword(password);
    await this.prisma.user.update({
      where: { id: adminUser.userId },
      data: { passwordHash },
    });

    const { clearedSessionKeys } = await this.revokeSessions(adminUser.userId);

    // A grant deactivated purely for want of a password can now be exercised.
    const reactivated = await this.prisma.adminUser.update({
      where: { id },
      data: { isActive: true },
      select: { isActive: true },
    });
    await this.cacheAdminPermissions(
      adminUser.userId,
      adminUser.adminRole,
      adminUser.permissions as Record<string, boolean>,
    );

    return {
      id,
      userId: adminUser.userId,
      isActive: reactivated.isActive,
      clearedSessionKeys,
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

    const { clearedSessionKeys, revokedTokenCount } = await this.revokeSessions(
      existing.userId,
    );

    // Clear cache
    await this.redis.getClient().del(`admin:permissions:${existing.userId}`);

    return { ...adminUser, clearedSessionKeys, revokedTokenCount };
  }

  /**
   * Terminates every active session for a user.
   *
   * The Redis delete is the part that works. `refresh-token.use-case` validates
   * the presented token against `session:{userId}:{tokenId}`, so removing those
   * keys makes outstanding refresh tokens unusable immediately.
   *
   * Deactivation previously only ran the `refresh_tokens` UPDATE below and cleared
   * the permissions cache. Since the current auth flow never writes to that table,
   * the update matched nothing — so a deactivated admin could keep refreshing
   * indefinitely and stayed signed in. The table update is retained only to cover
   * rows from an older or future DB-backed flow.
   */
  private async revokeSessions(
    userId: string,
  ): Promise<{ clearedSessionKeys: number; revokedTokenCount: number }> {
    let clearedSessionKeys = 0;

    try {
      clearedSessionKeys = await this.redis.delByPattern(`session:${userId}:*`);
    } catch (error) {
      this.logger.error(
        `Failed to clear Redis sessions for user ${userId} — outstanding ` +
          `refresh tokens may still work until they expire: ${(error as Error).message}`,
      );
    }

    const revoked = await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { clearedSessionKeys, revokedTokenCount: revoked.count };
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
