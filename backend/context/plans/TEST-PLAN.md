# DerLg Backend Test Plan

> What to test, how to test it, and what "done" looks like. Every module must satisfy this plan before it ships.

---

## 1. Test Levels

### 1.1 Unit Tests (`*.spec.ts`)
- **Target:** Services, utilities, DTO validation, pure functions
- **Speed:** < 100ms per test file
- **Mocking:** External dependencies only (Stripe, Redis, Email)
- **Coverage gate:** 80% lines minimum, 90% for auth/booking/payment

### 1.2 Integration Tests (`*.integration-spec.ts`)
- **Target:** Controller + Service + Prisma (test database)
- **Speed:** < 5s per test file
- **Mocking:** External APIs only (Stripe, Resend, FCM)
- **Database:** Real Postgres test database

### 1.3 E2E Tests (`*.e2e-spec.ts`)
- **Target:** Full HTTP request/response cycle
- **Speed:** < 30s per test file
- **Mocking:** External APIs, payment webhooks simulated
- **Database:** Fresh test database per suite

### 1.4 Property-Based Tests
- **Target:** Validation logic, state machines, idempotency
- **Tool:** `fast-check`
- **Goal:** Find edge cases missed by example-based tests

---

## 2. Coverage Gates

| Module | Unit | Integration | E2E | Property |
|--------|------|-------------|-----|----------|
| Auth | 90% | Yes | Yes | — |
| Users | 80% | Yes | — | — |
| Trips | 80% | Yes | — | — |
| Places | 80% | Yes | — | — |
| Hotels | 80% | Yes | — | — |
| Guides | 80% | Yes | — | — |
| Transportation | 80% | Yes | — | — |
| Bookings | 90% | Yes | Yes | Yes |
| Payments | 90% | Yes | Yes | Yes |
| Reviews | 80% | Yes | — | — |
| Favorites | 80% | Yes | — | — |
| Search | 80% | — | — | — |
| Student | 80% | Yes | — | — |
| Loyalty | 80% | Yes | — | Yes |
| Emergency | 80% | Yes | Yes | — |
| AI Tools | 80% | Yes | — | — |
| Admin | 80% | Yes | — | — |
| Common | 90% | — | — | — |

---

## 3. Critical Path E2E Tests

These MUST pass before any deployment:

### 3.1 Auth Flow
```
1. POST /auth/register → 201, tokens returned
2. POST /auth/login → 200, tokens returned
3. GET /users/me with Bearer → 200, profile returned
4. POST /auth/refresh → 200, new access token
5. POST /auth/logout → 200, refresh token invalidated
6. POST /auth/refresh with old token → 401
```

### 3.2 Booking Creation & Expiry
```
1. POST /guides/:id/bookings → 201, HOLD status
2. GET /bookings/:id → 200, shows HOLD
3. Check Redis: booking_hold:{id} exists with TTL
4. Wait 15 minutes (or TTL in test)
5. GET /bookings/:id → 200, shows EXPIRED
6. Redis key removed
```

### 3.3 Double Booking Prevention
```
1. User A creates guide booking for dates X-Y → 201
2. User B tries same guide, same dates → 409
3. User A cancels → 200
4. User B retries → 201
```

### 3.4 Payment Flow
```
1. Create booking → 201 (HOLD)
2. POST /payments/intent → 200, clientSecret returned
3. Simulate Stripe webhook payment_intent.succeeded → 200
4. GET /bookings/:id → 200, CONFIRMED
5. GET /payments/:id/status → 200, COMPLETED
```

### 3.5 Refund Flow
```
1. Create and confirm booking
2. POST /bookings/:id/cancel (7+ days before) → 200, 100% refund
3. GET /payments/:id/refund → 200, refund processed
4. Stripe webhook refund processed → booking shows refund
```

### 3.6 Idempotency
```
1. POST /guides/:id/bookings with Idempotency-Key: abc → 201
2. Same request with same key → 200, same response body
3. Different key, same data → 201, new booking
```

### 3.7 Review Flow
```
1. Complete a booking
2. POST /trips/:id/reviews → 201
3. GET /trips/:id/reviews → includes new review, verified badge
4. PATCH review within 7 days → 200
5. PATCH after 7 days → 403
```

### 3.8 Student Verification
```
1. POST /student-verification → 201, PENDING
2. Admin GET /admin/student-verifications → includes request
3. Admin POST /admin/student-verifications/:id/approve → 200
4. GET /users/me → role is 'student'
```

### 3.9 Emergency Alert
```
1. POST /emergency/alerts → 201
2. Admin GET /emergency/alerts/:id → 200
3. Admin POST /emergency/alerts/:id/acknowledge → 200
4. Admin POST /emergency/alerts/:id/resolve → 200
```

---

## 4. Unit Test Patterns

### 4.1 Service Tests

```typescript
describe('BookingService', () => {
  let service: BookingService;
  let prisma: DeepMocked<PrismaService>;
  let redis: DeepMocked<RedisService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BookingService,
        { provide: PrismaService, useValue: createMock<PrismaService>() },
        { provide: RedisService, useValue: createMock<RedisService>() },
      ],
    }).compile();

    service = module.get(BookingService);
    prisma = module.get(PrismaService);
    redis = module.get(RedisService);
  });

  describe('create', () => {
    it('should create booking and set Redis hold', async () => {
      prisma.booking.create.mockResolvedValue(mockBooking);
      redis.setex.mockResolvedValue('OK');

      const result = await service.create(dto, userId);

      expect(result.status).toBe('HOLD');
      expect(redis.setex).toHaveBeenCalledWith(
        `booking_hold:${result.id}`,
        900,
        '1',
      );
    });

    it('should throw ConflictException when dates overlap', async () => {
      prisma.$transaction.mockImplementation(async (fn) => {
        const tx = createMock<PrismaClient>();
        return fn(tx);
      });
      // ... overlap check returns true

      await expect(service.create(dto, userId)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
```

### 4.2 DTO Validation Tests

```typescript
describe('CreateBookingDto', () => {
  it('should pass with valid dates', async () => {
    const dto = plainToInstance(CreateBookingDto, {
      startDate: '2026-06-01',
      endDate: '2026-06-05',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail when endDate is before startDate', async () => {
    const dto = plainToInstance(CreateBookingDto, {
      startDate: '2026-06-05',
      endDate: '2026-06-01',
    });
    const errors = await validate(dto);
    expect(errors[0].property).toBe('endDate');
  });
});
```

### 4.3 Property-Based Tests

```typescript
describe('Booking date validation', () => {
  it('should reject any endDate before startDate', () => {
    fc.assert(
      fc.property(
        fc.date(),
        fc.date(),
        (start, end) => {
          if (end <= start) {
            const dto = plainToInstance(CreateBookingDto, {
              startDate: start.toISOString(),
              endDate: end.toISOString(),
            });
            return validate(dto).then(errors => errors.length > 0);
          }
          return true;
        },
      ),
    );
  });
});
```

---

## 5. Integration Test Patterns

### 5.1 Controller + Service + Prisma

```typescript
describe('BookingController (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [BookingModule, PrismaModule],
    }).compile();

    app = module.createNestApplication();
    prisma = module.get(PrismaService);
    await app.init();
  });

  beforeEach(async () => {
    await prisma.booking.deleteMany();
    await prisma.guide.deleteMany();
    // ... seed test data
  });

  it('POST /v1/guides/:id/bookings should create booking', async () => {
    const guide = await prisma.guide.create({ data: testGuide });

    const response = await request(app.getHttpServer())
      .post(`/v1/guides/${guide.id}/bookings`)
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        startDate: '2026-06-01',
        endDate: '2026-06-05',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('HOLD');
  });
});
```

---

## 6. E2E Test Setup

### 6.1 Test Database

```yaml
# docker-compose.test.yml
services:
  postgres-test:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: derlg_test
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    ports:
      - "5433:5432"

  redis-test:
    image: redis:7-alpine
    ports:
      - "6380:6379"
```

### 6.2 Test Environment

```bash
# .env.test
DATABASE_URL=postgresql://test:test@localhost:5433/derlg_test
REDIS_URL=redis://localhost:6380
JWT_ACCESS_SECRET=test-access-secret
JWT_REFRESH_SECRET=test-test-refresh-secret
STRIPE_SECRET_KEY=sk_test_...
```

### 6.3 E2E Bootstrap

```typescript
// test/setup-e2e.ts
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';

beforeAll(async () => {
  // Clean database
  const prisma = new PrismaClient();
  await prisma.$executeRaw`TRUNCATE TABLE bookings, payments, users CASCADE`;
  await prisma.$disconnect();

  // Seed minimal data
  // ...
});
```

---

## 7. Test Data Strategy

### 7.1 Factories

```typescript
// test/factories/user.factory.ts
export const createUser = (overrides?: Partial<User>): Prisma.UserCreateInput => ({
  email: faker.internet.email(),
  passwordHash: bcrypt.hashSync('password123', 12),
  name: faker.person.fullName(),
  role: 'USER',
  status: 'ACTIVE',
  ...overrides,
});

// test/factories/guide.factory.ts
export const createGuide = (overrides?: Partial<Prisma.GuideCreateInput>) => ({
  name: faker.person.fullName(),
  languages: ['EN'],
  specialties: ['Temples'],
  location: 'Siem Reap',
  pricePerDayUsd: 50.00,
  status: 'ACTIVE',
  ...overrides,
});
```

### 7.2 Seed Order
1. Users (with hashed passwords)
2. Guides, Hotels, Places, Trips, Vehicles
3. Bookings
4. Payments
5. Reviews
6. Favorites

---

## 8. Mocking Rules

| Dependency | Mock Strategy | Reason |
|------------|--------------|--------|
| Prisma | Real test DB (integration/E2E), mock (unit) | Type safety matters |
| Redis | Real test Redis (integration/E2E), mock (unit) | TTL behavior matters |
| Stripe | Stripe test API keys + webhook simulation | Real behavior matters |
| Resend/FCM | Mock (all levels) | Don't send real notifications |
| EventEmitter | Spy (unit), real (integration/E2E) | Verify events emitted |
| Clock | `jest.useFakeTimers()` | Test time-based logic |

---

## 9. CI/CD Test Pipeline

```yaml
# .github/workflows/test.yml
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
      redis:
        image: redis:7-alpine
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run lint
      - run: npm run format:check
      - run: npm run test -- --coverage
      - run: npm run test:e2e
      - uses: codecov/codecov-action@v4
```

---

## 10. Test Checklist (Per Module)

Before marking a module complete:

- [ ] Unit tests for all service public methods
- [ ] Unit tests for all DTO validations
- [ ] Integration tests for all controller endpoints
- [ ] E2E tests for critical flows (if applicable)
- [ ] Property-based tests for validation/state logic (if applicable)
- [ ] All tests pass: `npm run test`
- [ ] Coverage meets gate: `npm run test:cov`
- [ ] No `console.log` in tests — use `Logger` or `console.error` for debug
- [ ] Tests are deterministic (no random failures)
- [ ] Tests clean up after themselves

---

## 11. Performance Tests

| Test | Target | Frequency |
|------|--------|-----------|
| List endpoint latency | < 300ms @ 1000 records | Per release |
| Booking creation throughput | > 50 req/s | Per release |
| Concurrent booking (race test) | 0% overbooking @ 100 concurrent | Per release |
| Redis hold TTL accuracy | ±1s of 900s | Per release |
| Payment webhook handling | < 500ms end-to-end | Per release |

---

## 12. Security Tests

| Test | Method |
|------|--------|
| SQL injection | Fuzz all query params with `' OR 1=1 --` |
| JWT tampering | Modify payload, verify signature rejection |
| Rate limiting | Exceed threshold, verify 429 |
| CORS | Origin spoofing, verify rejection |
| IDOR | Access another user's booking with own JWT |
| Mass assignment | Send extra fields, verify whitelist rejection |

---

## References

- Constitution testing rules: `CONSTITUTION.md` §6
- Code standard test patterns: `CODE-STANDARD.md` §5
- Backend design testing: `.kiro/specs/backend-nestjs-supabase/design.md`
