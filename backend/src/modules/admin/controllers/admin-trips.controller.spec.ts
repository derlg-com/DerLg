import { AdminTripsController } from './admin-trips.controller';
import { AdminCustomersController } from './admin-customers.controller';

/**
 * Controller-level contract tests.
 *
 * Two things live here that service tests cannot see.
 *
 * First, the audit-log actor. `@CurrentUser('sub')` used to ignore its argument
 * and hand back the whole JWT payload, so every `createAuditLog` call received an
 * object where a uuid string was expected. Prisma rejected it and the service's
 * try/catch swallowed the error, leaving admin actions with no recorded actor for
 * a long time. Asserting the forwarded value is a plain string is what catches a
 * regression of that.
 *
 * Second, the response envelope. Paginated handlers must return the service result
 * DIRECTLY so `TransformInterceptor` wraps it as `{ success, data: { data, meta } }`.
 * A hand-built envelope with a sibling `meta` puts it outside `data`, and the admin
 * frontend's axios interceptor — which replaces the body with `body.data` — then
 * discards pagination silently.
 */
describe('AdminTripsController', () => {
  let controller: AdminTripsController;
  let service: {
    listTrips: jest.Mock;
    getTripById: jest.Mock;
    createTrip: jest.Mock;
    updateTrip: jest.Mock;
    setPublished: jest.Mock;
    deleteTrip: jest.Mock;
    listItinerary: jest.Mock;
    createItineraryItem: jest.Mock;
    updateItineraryItem: jest.Mock;
    deleteItineraryItem: jest.Mock;
    reorderItinerary: jest.Mock;
    setTripGuides: jest.Mock;
    createAuditLog: jest.Mock;
  };

  const TRIP = { id: 'trip-1', category: 'temples', isPublished: false };
  const ACTOR = 'admin-uuid-1';

  beforeEach(() => {
    service = {
      listTrips: jest.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
      getTripById: jest.fn().mockResolvedValue(TRIP),
      createTrip: jest.fn().mockResolvedValue(TRIP),
      updateTrip: jest.fn().mockResolvedValue(TRIP),
      setPublished: jest.fn().mockResolvedValue({ ...TRIP, isPublished: true }),
      deleteTrip: jest.fn().mockResolvedValue({ id: 'trip-1', deleted: true }),
      listItinerary: jest.fn().mockResolvedValue([]),
      createItineraryItem: jest.fn().mockResolvedValue([]),
      updateItineraryItem: jest.fn().mockResolvedValue([]),
      deleteItineraryItem: jest.fn().mockResolvedValue([]),
      reorderItinerary: jest.fn().mockResolvedValue([]),
      setTripGuides: jest.fn().mockResolvedValue(TRIP),
      createAuditLog: jest.fn().mockResolvedValue(undefined),
    };
    controller = new AdminTripsController(service as never);
  });

  /** Shape of the audit payload the controller hands to the service. */
  interface AuditCall {
    userId: string;
    entityType?: string;
    entityId?: string;
    metadata: Record<string, unknown> & {
      action?: string;
      changedFields?: string[];
      guideCount?: number;
    };
  }

  /** Every audit call must forward a uuid string, never the JWT payload object. */
  function expectStringActor(): AuditCall {
    expect(service.createAuditLog).toHaveBeenCalled();
    const call = service.createAuditLog.mock.calls[0][0] as AuditCall;
    expect(typeof call.userId).toBe('string');
    return call;
  }

  it('should return the paginated list unwrapped so meta survives the interceptor', async () => {
    const result = await controller.listTrips({} as never);

    // No hand-built envelope: TransformInterceptor adds it.
    expect(result).toEqual({ data: [], meta: { total: 0 } });
    expect(result).not.toHaveProperty('success');
  });

  it('should forward declared query filters to the service', async () => {
    await controller.listTrips({
      search: 'angkor',
      category: 'temples',
      isPublishedBool: true,
      page: 2,
      limit: 10,
    } as never);

    expect(service.listTrips).toHaveBeenCalledWith({
      search: 'angkor',
      category: 'temples',
      isPublished: true,
      page: 2,
      limit: 10,
    });
  });

  it('should wrap single-resource reads in the standard envelope', async () => {
    const result = await controller.getTrip('trip-1');

    expect(result).toEqual({
      success: true,
      data: TRIP,
      message: 'ok',
      error: null,
    });
  });

  it('should audit a create with a string actor id', async () => {
    await controller.createTrip(
      {
        category: 'temples',
        durationDays: 3,
        basePriceUsd: 100,
        translations: [{ language: 'en', title: 'T' }],
      } as never,
      ACTOR,
    );

    const call = expectStringActor();
    expect(call.userId).toBe(ACTOR);
    expect(call.entityType).toBe('TRIP');
    expect(call.metadata.action).toBe('CREATE_TRIP');
  });

  it('should record which languages a create carried', async () => {
    await controller.createTrip(
      {
        category: 'temples',
        durationDays: 3,
        basePriceUsd: 100,
        translations: [
          { language: 'en', title: 'T' },
          { language: 'zh', title: 'Z' },
        ],
      } as never,
      ACTOR,
    );

    expect(service.createAuditLog.mock.calls[0][0].metadata.languages).toEqual([
      'en',
      'zh',
    ]);
  });

  it('should audit an update with only field NAMES, not values', async () => {
    await controller.updateTrip('trip-1', { basePriceUsd: 500 }, ACTOR);

    const call = expectStringActor();
    expect(call.metadata.changedFields).toEqual(['basePriceUsd']);
    // Values are excluded deliberately: audit rows are widely readable.
    expect(JSON.stringify(call.metadata)).not.toContain('500');
  });

  it('should distinguish publish from unpublish in the audit action', async () => {
    await controller.setPublished('trip-1', { isPublished: true }, ACTOR);
    expect(service.createAuditLog.mock.calls[0][0].metadata.action).toBe(
      'PUBLISH_TRIP',
    );

    service.createAuditLog.mockClear();
    await controller.setPublished('trip-1', { isPublished: false }, ACTOR);
    expect(service.createAuditLog.mock.calls[0][0].metadata.action).toBe(
      'UNPUBLISH_TRIP',
    );
  });

  it('should audit a delete with a string actor id', async () => {
    await controller.deleteTrip('trip-1', ACTOR);

    const call = expectStringActor();
    expect(call.metadata.action).toBe('DELETE_TRIP');
  });

  it('should report the item count on a reorder rather than the payload', async () => {
    await controller.reorderItinerary(
      'trip-1',
      {
        items: [
          { itemId: 'i-1', dayNumber: 1, sortOrder: 0 },
          { itemId: 'i-2', dayNumber: 1, sortOrder: 1 },
        ],
      },
      ACTOR,
    );

    expect(service.createAuditLog.mock.calls[0][0].metadata.itemCount).toBe(2);
  });

  it('should audit guide assignment with a count', async () => {
    await controller.setTripGuides('trip-1', { guideIds: ['g-1'] }, ACTOR);

    const call = expectStringActor();
    expect(call.metadata.action).toBe('SET_TRIP_GUIDES');
    expect(call.metadata.guideCount).toBe(1);
  });

  it('should still return a response when the actor is unknown', async () => {
    // Audit logging is best-effort; a missing actor must not fail the mutation.
    const result = await controller.deleteTrip('trip-1', undefined);

    expect(result.success).toBe(true);
  });
});

describe('AdminCustomersController', () => {
  let controller: AdminCustomersController;
  let service: {
    getAllCustomers: jest.Mock;
    getCustomerById: jest.Mock;
    getCustomerReviews: jest.Mock;
    updateCustomer: jest.Mock;
    setCustomerStatus: jest.Mock;
    setCustomerRole: jest.Mock;
    createAuditLog: jest.Mock;
  };

  const ACTOR = 'admin-uuid-1';

  beforeEach(() => {
    service = {
      getAllCustomers: jest
        .fn()
        .mockResolvedValue({ data: [], meta: { total: 0 } }),
      getCustomerById: jest.fn().mockResolvedValue({ id: 'cust-1' }),
      getCustomerReviews: jest.fn().mockResolvedValue([]),
      updateCustomer: jest.fn().mockResolvedValue({ id: 'cust-1' }),
      setCustomerStatus: jest.fn().mockResolvedValue({
        id: 'cust-1',
        previousStatus: 'active',
        status: 'suspended',
        reason: 'fraud',
        revokedTokenCount: 0,
        clearedSessionKeys: 2,
      }),
      setCustomerRole: jest.fn().mockResolvedValue({
        id: 'cust-1',
        previousRole: 'user',
        role: 'guide',
      }),
      createAuditLog: jest.fn().mockResolvedValue(undefined),
    };
    controller = new AdminCustomersController(service as never);
  });

  it('should pass the status filter through to the service', async () => {
    await controller.getAllCustomers(undefined, 'suspended', '1', '20');

    expect(service.getAllCustomers).toHaveBeenCalledWith({
      search: undefined,
      status: 'suspended',
      page: '1',
      limit: '20',
    });
  });

  it('should return the customer list unwrapped so meta survives', async () => {
    const result = await controller.getAllCustomers();

    expect(result).not.toHaveProperty('success');
  });

  it('should record the suspension reason and session count in the audit log', async () => {
    await controller.setCustomerStatus(
      'cust-1',
      { status: 'suspended', reason: 'fraud' },
      ACTOR,
    );

    const call = service.createAuditLog.mock.calls[0][0];
    expect(typeof call.userId).toBe('string');
    expect(call.metadata).toMatchObject({
      action: 'SET_CUSTOMER_STATUS',
      previousStatus: 'active',
      newStatus: 'suspended',
      reason: 'fraud',
      clearedSessionKeys: 2,
    });
  });

  it('should report terminated sessions, not the meaningless token count', async () => {
    const result = await controller.setCustomerStatus(
      'cust-1',
      { status: 'suspended', reason: 'fraud' },
      ACTOR,
    );

    // `revokedTokenCount` is always 0 — the auth flow never writes the
    // refresh_tokens table — so surfacing it would understate what happened.
    expect(result.message).toContain('2 active session(s) terminated');
  });

  it('should use a distinct message when reactivating', async () => {
    service.setCustomerStatus.mockResolvedValue({
      id: 'cust-1',
      previousStatus: 'suspended',
      status: 'active',
      reason: 'cleared',
      revokedTokenCount: 0,
      clearedSessionKeys: 0,
    });

    const result = await controller.setCustomerStatus(
      'cust-1',
      { status: 'active', reason: 'cleared' },
      ACTOR,
    );

    expect(result.message).toBe('Customer reactivated');
  });

  it('should audit a profile edit with field names only', async () => {
    await controller.updateCustomer(
      'cust-1',
      { phone: '+855 12 345 678' },
      ACTOR,
    );

    const call = service.createAuditLog.mock.calls[0][0];
    expect(call.metadata.changedFields).toEqual(['phone']);
    // The number itself is PII and must not land in a widely readable audit row.
    expect(JSON.stringify(call.metadata)).not.toContain('855');
  });

  it('should forward the acting admin id to the role change for the self-edit guard', async () => {
    await controller.setCustomerRole('cust-1', { role: 'guide' }, ACTOR);

    // The service refuses a self-change, which it can only detect if the actor
    // reaches it.
    expect(service.setCustomerRole).toHaveBeenCalledWith(
      'cust-1',
      'guide',
      ACTOR,
    );
  });

  it('should audit the role transition', async () => {
    await controller.setCustomerRole('cust-1', { role: 'guide' }, ACTOR);

    expect(service.createAuditLog.mock.calls[0][0].metadata).toMatchObject({
      action: 'SET_CUSTOMER_ROLE',
      previousRole: 'user',
      newRole: 'guide',
    });
  });
});
