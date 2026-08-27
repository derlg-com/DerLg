import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '@prisma/client';

import { AdminRoleGuard, adminPermissionsCacheKey } from './admin-role.guard';

import type { ExecutionContext } from '@nestjs/common';

/**
 * Authorisation is the part of the merge with the least margin for error: it
 * replaced a guard that gated on a `'support'` role which does not exist in the
 * `user_role` enum, so it could never have granted access correctly.
 */
describe('AdminRoleGuard', () => {
  let guard: AdminRoleGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let redis: { get: jest.Mock; setex: jest.Mock };
  let prisma: { adminUser: { findUnique: jest.Mock } };

  const buildContext = (user?: {
    sub: string;
    email: string;
    role: string;
  }) => {
    const request: Record<string, unknown> = { user };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => undefined,
      getClass: () => undefined,
      __request: request,
    } as unknown as ExecutionContext & { __request: Record<string, unknown> };
  };

  const ADMIN_USER = {
    sub: 'user-1',
    email: 'ops@derlg.demo',
    role: 'operations_manager',
  };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    redis = {
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue(undefined),
    };
    prisma = { adminUser: { findUnique: jest.fn() } };

    guard = new AdminRoleGuard(
      reflector as unknown as Reflector,
      redis as never,
      prisma as never,
    );
  });

  it('should pass through routes with no @AdminRoles metadata', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(guard.canActivate(buildContext(ADMIN_USER))).resolves.toBe(
      true,
    );
    // Critically, it must not have consulted the database — this is the
    // pass-through path used by every non-admin route in the app.
    expect(prisma.adminUser.findUnique).not.toHaveBeenCalled();
  });

  it('should pass through when @AdminRoles is present but empty', async () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    await expect(guard.canActivate(buildContext(ADMIN_USER))).resolves.toBe(
      true,
    );
  });

  it('should deny when the request carries no authenticated user', async () => {
    reflector.getAllAndOverride.mockReturnValue([AdminRole.SUPER_ADMIN]);

    await expect(guard.canActivate(buildContext(undefined))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should deny when the user has no admin_users row', async () => {
    reflector.getAllAndOverride.mockReturnValue([AdminRole.OPERATIONS_MANAGER]);
    prisma.adminUser.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(buildContext(ADMIN_USER))).rejects.toThrow(
      'Access denied: not an admin user',
    );
  });

  it('should deny a deactivated admin', async () => {
    reflector.getAllAndOverride.mockReturnValue([AdminRole.OPERATIONS_MANAGER]);
    prisma.adminUser.findUnique.mockResolvedValue({
      adminRole: AdminRole.OPERATIONS_MANAGER,
      permissions: null,
      isActive: false,
    });

    await expect(guard.canActivate(buildContext(ADMIN_USER))).rejects.toThrow(
      'Access denied: admin account is deactivated',
    );
  });

  it('should deny a role that is not listed, and name what was required', async () => {
    reflector.getAllAndOverride.mockReturnValue([AdminRole.SUPER_ADMIN]);
    prisma.adminUser.findUnique.mockResolvedValue({
      adminRole: AdminRole.SUPPORT_AGENT,
      permissions: null,
      isActive: true,
    });

    await expect(guard.canActivate(buildContext(ADMIN_USER))).rejects.toThrow(
      'requires one of [SUPER_ADMIN], but you have SUPPORT_AGENT',
    );
  });

  it('should allow a listed role and attach the grant to the request', async () => {
    reflector.getAllAndOverride.mockReturnValue([AdminRole.OPERATIONS_MANAGER]);
    prisma.adminUser.findUnique.mockResolvedValue({
      adminRole: AdminRole.OPERATIONS_MANAGER,
      permissions: { canRefund: true },
      isActive: true,
    });

    const context = buildContext(ADMIN_USER);
    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(context.__request.adminUser).toEqual({
      userId: 'user-1',
      adminRole: AdminRole.OPERATIONS_MANAGER,
      permissions: { canRefund: true },
    });
  });

  it('should let SUPER_ADMIN through a route it is not listed on', async () => {
    reflector.getAllAndOverride.mockReturnValue([AdminRole.FLEET_MANAGER]);
    prisma.adminUser.findUnique.mockResolvedValue({
      adminRole: AdminRole.SUPER_ADMIN,
      permissions: null,
      isActive: true,
    });

    await expect(guard.canActivate(buildContext(ADMIN_USER))).resolves.toBe(
      true,
    );
  });

  describe('permission cache', () => {
    it('should serve a cache hit without touching the database', async () => {
      reflector.getAllAndOverride.mockReturnValue([
        AdminRole.OPERATIONS_MANAGER,
      ]);
      redis.get.mockResolvedValue(
        JSON.stringify({
          adminRole: AdminRole.OPERATIONS_MANAGER,
          permissions: null,
          isActive: true,
        }),
      );

      await expect(guard.canActivate(buildContext(ADMIN_USER))).resolves.toBe(
        true,
      );
      expect(prisma.adminUser.findUnique).not.toHaveBeenCalled();
    });

    it('should populate the cache after a miss', async () => {
      reflector.getAllAndOverride.mockReturnValue([
        AdminRole.OPERATIONS_MANAGER,
      ]);
      prisma.adminUser.findUnique.mockResolvedValue({
        adminRole: AdminRole.OPERATIONS_MANAGER,
        permissions: null,
        isActive: true,
      });

      await guard.canActivate(buildContext(ADMIN_USER));

      expect(redis.setex).toHaveBeenCalledWith(
        adminPermissionsCacheKey('user-1'),
        300,
        expect.stringContaining('OPERATIONS_MANAGER'),
      );
    });

    it('should fall back to the database when Redis read fails', async () => {
      // Redis being unavailable is an availability problem, not an
      // authorisation one, so it must not lock admins out.
      reflector.getAllAndOverride.mockReturnValue([
        AdminRole.OPERATIONS_MANAGER,
      ]);
      redis.get.mockRejectedValue(new Error('connection refused'));
      prisma.adminUser.findUnique.mockResolvedValue({
        adminRole: AdminRole.OPERATIONS_MANAGER,
        permissions: null,
        isActive: true,
      });

      await expect(guard.canActivate(buildContext(ADMIN_USER))).resolves.toBe(
        true,
      );
      expect(prisma.adminUser.findUnique).toHaveBeenCalled();
    });

    it('should still allow when the cache write fails', async () => {
      reflector.getAllAndOverride.mockReturnValue([
        AdminRole.OPERATIONS_MANAGER,
      ]);
      redis.setex.mockRejectedValue(new Error('OOM'));
      prisma.adminUser.findUnique.mockResolvedValue({
        adminRole: AdminRole.OPERATIONS_MANAGER,
        permissions: null,
        isActive: true,
      });

      await expect(guard.canActivate(buildContext(ADMIN_USER))).resolves.toBe(
        true,
      );
    });

    it('should deny a cached grant that has been deactivated', async () => {
      reflector.getAllAndOverride.mockReturnValue([
        AdminRole.OPERATIONS_MANAGER,
      ]);
      redis.get.mockResolvedValue(
        JSON.stringify({
          adminRole: AdminRole.OPERATIONS_MANAGER,
          permissions: null,
          isActive: false,
        }),
      );

      await expect(guard.canActivate(buildContext(ADMIN_USER))).rejects.toThrow(
        'deactivated',
      );
    });
  });
});
