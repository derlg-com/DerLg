import { ConflictException, NotFoundException } from '@nestjs/common';

import { AdminUsersService } from './admin-users.service';

/**
 * Two behaviours here were outright broken before this work.
 *
 * `createAdminUser` wrote the `users` row with a random `supabaseUid` and NO
 * `passwordHash`. Sign-in checks `users.password_hash`, so every admin created
 * through the panel was locked out from the moment it was made.
 *
 * `deactivateAdminUser` "revoked" sessions by updating `refresh_tokens` — a table
 * the auth flow never writes to, since tokens live only in Redis at
 * `session:{userId}:{tokenId}`. The update matched nothing, so a deactivated admin
 * kept refreshing indefinitely and stayed signed in.
 */
describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let prisma: {
    adminUser: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    user: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    refreshToken: { updateMany: jest.Mock };
    auditLog: { create: jest.Mock };
  };
  let redis: { getClient: jest.Mock; delByPattern: jest.Mock };
  let redisClient: { del: jest.Mock; setex: jest.Mock };

  beforeEach(() => {
    redisClient = {
      del: jest.fn().mockResolvedValue(1),
      setex: jest.fn().mockResolvedValue('OK'),
    };
    redis = {
      getClient: jest.fn(() => redisClient),
      delByPattern: jest.fn().mockResolvedValue(2),
    };
    prisma = {
      adminUser: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({
          id: 'grant-1',
          userId: 'user-1',
          adminRole: 'OPERATIONS_MANAGER',
          permissions: {},
        }),
        create: jest.fn().mockResolvedValue({
          id: 'grant-1',
          userId: 'user-1',
          adminRole: 'OPERATIONS_MANAGER',
          permissions: {},
          isActive: true,
          createdAt: new Date(),
        }),
        update: jest.fn().mockResolvedValue({ id: 'grant-1', isActive: true }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'ops@derlg.demo',
          fullName: 'Ops',
          phone: null,
          role: 'operations_manager',
          status: 'active',
          passwordHash: '$2b$12$hash',
          createdAt: new Date(),
        }),
        create: jest.fn().mockResolvedValue({ id: 'user-1' }),
        update: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
      refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    service = new AdminUsersService(prisma as never, redis as never);
  });

  describe('createAdminUser', () => {
    const base = {
      email: 'New.Ops@derlg.demo',
      adminRole: 'OPERATIONS_MANAGER' as never,
    };

    it('should store a password hash when one is supplied', async () => {
      await service.createAdminUser({ ...base, password: 'OpsPass!2026' });

      const data = prisma.user.create.mock.calls[0][0].data;
      expect(data.passwordHash).toBeTruthy();
      // Hashed, never the plaintext.
      expect(data.passwordHash).not.toBe('OpsPass!2026');
    });

    it('should create an ACTIVE grant when the account can sign in', async () => {
      await service.createAdminUser({ ...base, password: 'OpsPass!2026' });

      expect(prisma.adminUser.create.mock.calls[0][0].data.isActive).toBe(true);
    });

    it('should create an INACTIVE grant when no password is supplied', async () => {
      const result = await service.createAdminUser(base);

      // Otherwise the panel hands back an account that looks ready but can never
      // log in.
      expect(prisma.adminUser.create.mock.calls[0][0].data.isActive).toBe(
        false,
      );
      expect(result.canSignIn).toBe(false);
    });

    it('should not cache permissions for a grant that cannot be exercised', async () => {
      await service.createAdminUser(base);

      expect(redisClient.setex).not.toHaveBeenCalled();
    });

    it('should lowercase the stored email', async () => {
      await service.createAdminUser({ ...base, password: 'OpsPass!2026' });

      expect(prisma.user.create.mock.calls[0][0].data.email).toBe(
        'new.ops@derlg.demo',
      );
    });

    it("should never blank an existing user's password when none is supplied", async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        passwordHash: '$2b$12$existing',
      });
      prisma.adminUser.findUnique.mockResolvedValue(null);

      await service.createAdminUser(base);

      // This user may already sign in as a customer; overwriting would lock them
      // out of that account.
      expect(prisma.user.update.mock.calls[0][0].data).not.toHaveProperty(
        'passwordHash',
      );
    });

    it('should treat an existing user with a password as able to sign in', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        passwordHash: '$2b$12$existing',
      });
      prisma.adminUser.findUnique.mockResolvedValue(null);

      const result = await service.createAdminUser(base);

      expect(result.canSignIn).toBe(true);
    });

    it('should refuse a second grant for the same user', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prisma.adminUser.findUnique.mockResolvedValue({ id: 'existing-grant' });

      await expect(service.createAdminUser(base)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('getAdminUserById', () => {
    it('should expose canSignIn as a boolean and never the hash', async () => {
      const result = await service.getAdminUserById('grant-1');

      expect(result.canSignIn).toBe(true);
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should 404 for an unknown grant', async () => {
      prisma.adminUser.findUnique.mockResolvedValue(null);

      await expect(service.getAdminUserById('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('resetAdminPassword', () => {
    it("should terminate the user's Redis sessions", async () => {
      const result = await service.resetAdminPassword(
        'grant-1',
        'NewPass!2026',
      );

      // A reset usually responds to a suspected compromise; leaving the old
      // sessions alive would defeat it.
      expect(redis.delByPattern).toHaveBeenCalledWith('session:user-1:*');
      expect(result.clearedSessionKeys).toBe(2);
    });

    it('should reactivate a grant that was inactive only for want of a password', async () => {
      const result = await service.resetAdminPassword(
        'grant-1',
        'NewPass!2026',
      );

      expect(prisma.adminUser.update.mock.calls[0][0].data.isActive).toBe(true);
      expect(result.isActive).toBe(true);
    });

    it('should write a hash, not the plaintext', async () => {
      await service.resetAdminPassword('grant-1', 'NewPass!2026');

      expect(prisma.user.update.mock.calls[0][0].data.passwordHash).not.toBe(
        'NewPass!2026',
      );
    });

    it('should 404 for an unknown grant', async () => {
      prisma.adminUser.findUnique.mockResolvedValue(null);

      await expect(
        service.resetAdminPassword('missing', 'NewPass!2026'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivateAdminUser', () => {
    it('should clear the Redis sessions that actually gate refresh', async () => {
      const result = await service.deactivateAdminUser('grant-1');

      // The refresh_tokens UPDATE alone was a no-op, so deactivation used to
      // leave the admin signed in.
      expect(redis.delByPattern).toHaveBeenCalledWith('session:user-1:*');
      expect(result.clearedSessionKeys).toBe(2);
    });

    it('should drop the cached permissions grant', async () => {
      await service.deactivateAdminUser('grant-1');

      expect(redisClient.del).toHaveBeenCalledWith('admin:permissions:user-1');
    });

    it('should still deactivate when Redis is unavailable', async () => {
      redis.delByPattern.mockRejectedValue(new Error('redis down'));

      const result = await service.deactivateAdminUser('grant-1');

      expect(prisma.adminUser.update).toHaveBeenCalled();
      expect(result.clearedSessionKeys).toBe(0);
    });

    it('should 404 for an unknown grant', async () => {
      prisma.adminUser.findUnique.mockResolvedValue(null);

      await expect(service.deactivateAdminUser('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getAllAdminUsers', () => {
    const GRANT = {
      id: 'grant-1',
      userId: 'user-1',
      adminRole: 'OPERATIONS_MANAGER',
      permissions: { MANAGE_BOOKINGS: true },
      isActive: true,
      createdAt: new Date('2026-01-01'),
    };

    it('should join each grant to its user profile', async () => {
      prisma.adminUser.findMany.mockResolvedValue([GRANT]);
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'user-1',
          email: 'ops@derlg.demo',
          fullName: 'Ops',
          phone: '+85512345678',
          role: 'operations_manager',
          createdAt: new Date('2025-12-01'),
        },
      ]);

      const [row] = await service.getAllAdminUsers();

      expect(row.email).toBe('ops@derlg.demo');
      expect(row.fullName).toBe('Ops');
      expect(row.adminRole).toBe('OPERATIONS_MANAGER');
      expect(row.permissions).toEqual({ MANAGE_BOOKINGS: true });
    });

    it('should never select the password hash', async () => {
      prisma.adminUser.findMany.mockResolvedValue([GRANT]);

      await service.getAllAdminUsers();

      const select = prisma.user.findMany.mock.calls[0][0].select;
      expect(select).not.toHaveProperty('passwordHash');
    });

    it('should batch the profile lookup into one query rather than one per grant', async () => {
      prisma.adminUser.findMany.mockResolvedValue([
        GRANT,
        { ...GRANT, id: 'grant-2', userId: 'user-2' },
        { ...GRANT, id: 'grant-3', userId: 'user-3' },
      ]);

      await service.getAllAdminUsers();

      // An N+1 here would be three findMany calls, or three findUnique calls.
      expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({
        id: { in: ['user-1', 'user-2', 'user-3'] },
      });
    });

    it('should skip the profile query entirely when there are no grants', async () => {
      prisma.adminUser.findMany.mockResolvedValue([]);

      const result = await service.getAllAdminUsers();

      expect(result).toEqual([]);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('should null the profile fields for a grant whose user row is gone', async () => {
      prisma.adminUser.findMany.mockResolvedValue([GRANT]);
      prisma.user.findMany.mockResolvedValue([]);

      const [row] = await service.getAllAdminUsers();

      // The grant is still listed — hiding it would make an orphaned grant
      // invisible and therefore impossible to revoke from the panel.
      expect(row.id).toBe('grant-1');
      expect(row.email).toBeNull();
      expect(row.fullName).toBeNull();
      expect(row.role).toBeNull();
      expect(row.userCreatedAt).toBeNull();
    });
  });

  describe('updateAdminUser', () => {
    it('should 404 for an unknown grant', async () => {
      prisma.adminUser.findUnique.mockResolvedValue(null);

      await expect(
        service.updateAdminUser('missing', { isActive: true }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.adminUser.update).not.toHaveBeenCalled();
    });

    it('should drop the cached permissions so the next request re-reads the grant', async () => {
      await service.updateAdminUser('grant-1', {
        adminRole: 'FLEET_MANAGER',
      });

      // AdminRoleGuard caches for 5 minutes; without this a demoted admin keeps
      // their old role until the TTL lapses.
      expect(redisClient.del).toHaveBeenCalledWith('admin:permissions:user-1');
    });

    it('should re-cache the new role when the grant stays active', async () => {
      await service.updateAdminUser('grant-1', {
        adminRole: 'FLEET_MANAGER',
        permissions: { MANAGE_VEHICLES: true },
      });

      expect(redisClient.setex).toHaveBeenCalled();
      const [key, , payload] = redisClient.setex.mock.calls[0] as [
        string,
        number,
        string,
      ];
      expect(key).toBe('admin:permissions:user-1');
      expect(JSON.parse(payload)).toEqual({
        adminRole: 'FLEET_MANAGER',
        permissions: { MANAGE_VEHICLES: true },
        isActive: true,
      });
    });

    it('should fall back to the existing permissions when the update omits them', async () => {
      prisma.adminUser.findUnique.mockResolvedValue({
        id: 'grant-1',
        userId: 'user-1',
        adminRole: 'OPERATIONS_MANAGER',
        permissions: { MANAGE_BOOKINGS: true },
      });

      await service.updateAdminUser('grant-1', {
        adminRole: 'FLEET_MANAGER',
      });

      const payload = JSON.parse(
        redisClient.setex.mock.calls[0][2] as string,
      ) as { permissions: Record<string, boolean> };
      expect(payload.permissions).toEqual({ MANAGE_BOOKINGS: true });
    });

    it('should not re-cache a grant that is being deactivated', async () => {
      await service.updateAdminUser('grant-1', {
        adminRole: 'FLEET_MANAGER',
        isActive: false,
      });

      // Re-caching here would resurrect the grant for the whole cache TTL.
      expect(redisClient.del).toHaveBeenCalled();
      expect(redisClient.setex).not.toHaveBeenCalled();
    });

    it('should not re-cache when only permissions change without a role', async () => {
      await service.updateAdminUser('grant-1', {
        permissions: { MANAGE_BOOKINGS: false },
      });

      // The del alone is correct: the guard re-reads from Postgres on a miss.
      expect(redisClient.del).toHaveBeenCalled();
      expect(redisClient.setex).not.toHaveBeenCalled();
    });

    it('should still update when the Redis cache write fails', async () => {
      redisClient.setex.mockRejectedValue(new Error('redis down'));

      const result = await service.updateAdminUser('grant-1', {
        adminRole: 'FLEET_MANAGER',
      });

      // A cache failure must not roll back the authoritative Postgres write.
      expect(prisma.adminUser.update).toHaveBeenCalled();
      expect(result).toEqual({ id: 'grant-1', isActive: true });
    });
  });

  describe('createAuditLog', () => {
    it('should persist the actor, event type and metadata', async () => {
      await service.createAuditLog({
        userId: 'admin-1',
        eventType: 'admin_action',
        entityType: 'ADMIN_USER',
        entityId: 'grant-1',
        metadata: { action: 'UPDATE_ADMIN_USER' },
      });

      expect(prisma.auditLog.create.mock.calls[0][0].data).toEqual({
        userId: 'admin-1',
        eventType: 'admin_action',
        entityType: 'ADMIN_USER',
        entityId: 'grant-1',
        metadata: { action: 'UPDATE_ADMIN_USER' },
      });
    });

    it('should null a missing actor and default metadata to an empty object', async () => {
      await service.createAuditLog({
        eventType: 'admin_action',
        entityType: 'ADMIN_USER',
      });

      const data = prisma.auditLog.create.mock.calls[0][0].data;
      expect(data.userId).toBeNull();
      expect(data.entityId).toBeNull();
      expect(data.metadata).toEqual({});
    });

    it('should swallow a write failure so the audited action still succeeds', async () => {
      prisma.auditLog.create.mockRejectedValue(new Error('db down'));

      // Deliberate: losing the audit row is bad, but failing the admin's actual
      // request because the log table is unavailable is worse.
      await expect(
        service.createAuditLog({
          eventType: 'admin_action',
          entityType: 'ADMIN_USER',
        }),
      ).resolves.toBeUndefined();
    });
  });
});
