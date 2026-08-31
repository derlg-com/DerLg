import { AdminUsersController } from './admin-users.controller';

/**
 * Controller-level contract tests for admin-user management.
 *
 * The audit actor is the main thing under test. `@CurrentUser('sub')` used to
 * ignore its argument and hand back the whole JWT payload, so every
 * `createAuditLog` call received an object where a uuid string was annotated.
 * Prisma rejected it and the service's try/catch swallowed the failure, leaving
 * privileged actions — creating admins, resetting their passwords — with no
 * recorded actor. Asserting the forwarded value is a plain string is what catches
 * a regression.
 *
 * The other thing is the messaging around passwordless creation. An admin created
 * without a password cannot sign in, and the only remedy is the reset-password
 * route. If the response does not say so, the operator is left with an account
 * that looks created but silently rejects every login.
 */
describe('AdminUsersController', () => {
  let controller: AdminUsersController;
  let service: {
    getAllAdminUsers: jest.Mock;
    getAdminUserById: jest.Mock;
    createAdminUser: jest.Mock;
    resetAdminPassword: jest.Mock;
    updateAdminUser: jest.Mock;
    deactivateAdminUser: jest.Mock;
    createAuditLog: jest.Mock;
  };

  const ACTOR = 'admin-uuid-1';
  const TARGET = '11111111-1111-1111-1111-111111111111';
  const ADMIN = {
    id: 'grant-1',
    userId: TARGET,
    email: 'ops@derlg.demo',
    adminRole: 'OPERATIONS_MANAGER',
    canSignIn: true,
  };

  /** Shape of the audit payload the controller hands to the service. */
  interface AuditCall {
    userId: string;
    eventType: string;
    entityType: string;
    entityId: string;
    metadata: Record<string, unknown> & {
      action?: string;
      fields?: string[];
      passwordSet?: boolean;
      clearedSessionKeys?: number;
    };
  }

  /** Every audit call must forward a uuid string, never the JWT payload object. */
  function expectStringActor(): AuditCall {
    expect(service.createAuditLog).toHaveBeenCalled();
    const call = service.createAuditLog.mock.calls[0][0] as AuditCall;
    expect(typeof call.userId).toBe('string');
    return call;
  }

  beforeEach(() => {
    service = {
      getAllAdminUsers: jest.fn().mockResolvedValue([ADMIN]),
      getAdminUserById: jest.fn().mockResolvedValue(ADMIN),
      createAdminUser: jest.fn().mockResolvedValue(ADMIN),
      resetAdminPassword: jest
        .fn()
        .mockResolvedValue({ userId: TARGET, clearedSessionKeys: 2 }),
      updateAdminUser: jest.fn().mockResolvedValue(ADMIN),
      deactivateAdminUser: jest
        .fn()
        .mockResolvedValue({ userId: TARGET, isActive: false }),
      createAuditLog: jest.fn().mockResolvedValue(undefined),
    };
    controller = new AdminUsersController(service as never);
  });

  describe('read routes', () => {
    it('should wrap the list in the standard envelope', async () => {
      const result = await controller.getAllAdminUsers();

      expect(result).toEqual({
        success: true,
        data: [ADMIN],
        message: 'ok',
        error: null,
      });
    });

    it('should wrap a single admin user', async () => {
      const result = await controller.getAdminUserById(TARGET);

      expect(service.getAdminUserById).toHaveBeenCalledWith(TARGET);
      expect(result.data).toEqual(ADMIN);
    });

    it('should not write an audit log for reads', async () => {
      await controller.getAllAdminUsers();
      await controller.getAdminUserById(TARGET);

      expect(service.createAuditLog).not.toHaveBeenCalled();
    });
  });

  describe('createAdminUser', () => {
    const dto = {
      email: 'ops@derlg.demo',
      fullName: 'Ops',
      adminRole: 'OPERATIONS_MANAGER',
    };

    it('should audit the creation with a string actor', async () => {
      await controller.createAdminUser(dto as never, ACTOR);

      const call = expectStringActor();
      expect(call.userId).toBe(ACTOR);
      expect(call.entityType).toBe('ADMIN_USER');
      expect(call.entityId).toBe(ADMIN.id);
      expect(call.metadata.action).toBe('CREATE_ADMIN_USER');
    });

    it('should record only whether a password was set, never the password', async () => {
      await controller.createAdminUser(
        { ...dto, password: 'SuperSecret!2026' } as never,
        ACTOR,
      );

      const call = expectStringActor();
      expect(call.metadata.passwordSet).toBe(true);
      expect(JSON.stringify(call.metadata)).not.toContain('SuperSecret');
    });

    it('should confirm success when the account can sign in', async () => {
      const result = await controller.createAdminUser(dto as never, ACTOR);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Admin user created successfully');
    });

    it('should warn that a passwordless account is unusable and name the remedy', async () => {
      service.createAdminUser.mockResolvedValue({ ...ADMIN, canSignIn: false });

      const result = await controller.createAdminUser(dto as never, ACTOR);

      expect(result.success).toBe(true);
      expect(result.message).toContain('INACTIVE');
      expect(result.message).toContain('reset-password');
    });
  });

  describe('resetAdminPassword', () => {
    it('should classify the audit entry as a security event, not a plain admin action', async () => {
      await controller.resetAdminPassword(
        TARGET,
        { password: 'SuperSecret!2026' },
        ACTOR,
      );

      const call = expectStringActor();
      expect(call.eventType).toBe('security_event');
      expect(call.metadata.action).toBe('RESET_ADMIN_PASSWORD');
    });

    it('should never put the new password in the audit metadata', async () => {
      await controller.resetAdminPassword(
        TARGET,
        { password: 'SuperSecret!2026' },
        ACTOR,
      );

      const call = expectStringActor();
      expect(JSON.stringify(call.metadata)).not.toContain('SuperSecret');
    });

    it('should report how many sessions were terminated', async () => {
      const result = await controller.resetAdminPassword(
        TARGET,
        { password: 'SuperSecret!2026' },
        ACTOR,
      );

      expect(result.message).toBe(
        'Password reset; 2 active session(s) terminated',
      );
      expect(result.data).toEqual({ userId: TARGET, clearedSessionKeys: 2 });
    });
  });

  describe('updateAdminUser', () => {
    it('should audit which fields changed without recording their values', async () => {
      await controller.updateAdminUser(
        TARGET,
        { adminRole: 'FLEET_MANAGER', isActive: false } as never,
        ACTOR,
      );

      const call = expectStringActor();
      expect(call.metadata.action).toBe('UPDATE_ADMIN_USER');
      expect(call.metadata.fields).toEqual(['adminRole', 'isActive']);
      // Values are excluded deliberately: audit rows are widely readable.
      expect(JSON.stringify(call.metadata)).not.toContain('FLEET_MANAGER');
    });

    it('should return the updated grant', async () => {
      const result = await controller.updateAdminUser(
        TARGET,
        { isActive: true },
        ACTOR,
      );

      expect(result.data).toEqual(ADMIN);
      expect(result.message).toBe('Admin user updated successfully');
    });
  });

  describe('deactivateAdminUser', () => {
    it('should audit the deactivation with a string actor', async () => {
      await controller.deactivateAdminUser(TARGET, ACTOR);

      const call = expectStringActor();
      expect(call.userId).toBe(ACTOR);
      expect(call.metadata.action).toBe('DEACTIVATE_ADMIN_USER');
      expect(call.metadata.userId).toBe(TARGET);
    });

    it('should return the deactivated grant', async () => {
      const result = await controller.deactivateAdminUser(TARGET, ACTOR);

      expect(service.deactivateAdminUser).toHaveBeenCalledWith(TARGET);
      expect(result.data).toEqual({ userId: TARGET, isActive: false });
    });
  });

  describe('unauthenticated edge case', () => {
    it('should still audit when no actor claim is present', async () => {
      // `@CurrentUser('sub')` is optional in the signature, so a malformed token
      // must not lose the audit trail entirely.
      await controller.deactivateAdminUser(TARGET);

      expect(service.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ userId: undefined }),
      );
    });
  });
});
