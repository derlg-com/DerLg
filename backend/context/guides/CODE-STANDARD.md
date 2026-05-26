# DerLg Backend Code Standard

> How we write code. Every line committed to `backend/` must follow these rules. Reviewers reject PRs that violate this document.

---

## 1. Formatting & Style

### 1.1 Prettier (non-negotiable)
All code is formatted by Prettier. No manual formatting debates.

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "tabWidth": 2,
  "semi": true,
  "printWidth": 100
}
```

**Rule:** Run `npm run format` before every commit. CI fails if code is not Prettier-clean.

### 1.2 ESLint (non-negotiable)
All code passes ESLint with zero errors. Warnings are treated as errors in CI.

Key rules:
- `@typescript-eslint/no-explicit-any: off` — allowed when genuinely needed
- `@typescript-eslint/no-floating-promises: warn` — must handle or explicitly void
- `prettier/prettier: error` — Prettier violations are build failures
- `@typescript-eslint/explicit-function-return-type: off` — inference is fine
- `@typescript-eslint/no-unused-vars: error` — no dead code

**Rule:** Run `npm run lint` before every commit.

### 1.3 Import Order
Use this exact order, separated by blank lines:

```typescript
// 1. NestJS / Node built-ins
import { Controller, Get } from '@nestjs/common';
import { Request } from 'express';

// 2. Third-party packages
import { omit } from 'lodash';

// 3. Absolute imports from src/
import { RedisService } from 'src/redis/redis.service';
import { AuthGuard } from 'src/common/guards/auth.guard';

// 4. Relative imports from same module
import { CreateBookingUseCase } from './use-cases/create-booking.use-case';
import { CreateBookingDto } from './dto/create-booking.dto';
```

**Rule:** Inside a feature module, prefer relative imports. To reach the shared kernel from a use case, the canonical depth is `../../../common/...` (because use cases live two folders deep, `src/modules/<feature>/use-cases/`). This is **explicitly allowed** — see § 3.3 Use-Case Pattern. Anywhere else, do not exceed `../../..`. Use absolute `src/` imports only for cross-module references that cannot be expressed within the use-case pattern.

---

## 2. TypeScript Patterns

### 2.1 Strict Mode
- `strictNullChecks: true` — always handle `null`/`undefined`
- `noImplicitAny: false` — explicit `any` is allowed but discouraged
- `strictBindCallApply: false` — relaxed for decorator compatibility

### 2.2 Types Over Interfaces (for DTOs)
Use `interface` for public contracts, `type` for unions/compositions:

```typescript
// Good — public API contract
export interface CreateBookingDto {
  startDate: Date;
  endDate: Date;
}

// Good — internal union
type BookingStatus = 'HOLD' | 'CONFIRMED' | 'CANCELLED';

// Bad — using type for a simple object contract
type BadDto = { name: string };
```

### 2.3 No Enums (use const objects)
NestJS/Prisma enums are the exception. In application code, prefer const objects:

```typescript
// Good — tree-shakeable, no generated code
export const BookingStatus = {
  HOLD: 'HOLD',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
} as const;

export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

// Bad — generates IIFE, harder to tree-shake
enum BadBookingStatus {
  HOLD = 'HOLD',
}
```

**Exception:** Prisma-generated enums and NestJS `@ApiProperty({ enum: ... })` may use TS enums.

### 2.4 Explicit Return Types on Public Methods
The `execute()` method on every use case **must** declare an explicit return type:

```typescript
// Good
async execute(id: string): Promise<BookingDetail | null> {
  return this.prisma.booking.findUnique({ where: { id, deletedAt: null } });
}

// Bad — inference hides the contract
async execute(id: string) {
  return this.prisma.booking.findUnique({ where: { id, deletedAt: null } });
}
```

Private helpers may omit return types if inference is obvious.

### 2.5 Null Handling
Always handle the null case explicitly:

```typescript
// Good
const booking = await this.getBookingDetail.execute(id);
if (!booking) {
  throw new NotFoundException({ code: ErrorCode.BKNG_NOT_FOUND, message: 'Booking not found' });
}

// Bad — implicit null dereference
const booking = await this.getBookingDetail.execute(id);
return booking.status; // may throw at runtime
```

Use optional chaining when appropriate:

```typescript
const name = user?.profile?.name ?? 'Guest';
```

---

## 3. NestJS Patterns

> **Architectural standard (mandatory from Phase 3 onwards):** every feature module uses the **use-case pattern**, mirroring `backend/src/modules/auth/`. There are **no `<feature>.service.ts`** files in feature modules. Per-endpoint business logic lives in `*UseCase` classes with a single public `execute()` method. See § 3.3.

### 3.1 Module Structure
Every feature module is a self-contained unit. Providers list every use case explicitly:

```typescript
@Module({
  imports: [PrismaModule, RedisModule, CommonModule], // shared kernel only
  controllers: [BookingController],
  providers: [
    CreateBookingUseCase,
    GetBookingDetailUseCase,
    ListMyBookingsUseCase,
    CancelBookingUseCase,
  ],
})
export class BookingModule {}
```

**Rule:** Feature modules do NOT import other feature modules. Cross-feature communication via events or Prisma relations only. Modules export use cases only when another module legitimately needs to invoke them (rare).

### 3.2 Controller Patterns
One controller per module. **Controllers are thin** — they validate input via DTOs, call a single `useCase.execute(...)`, and return the result. No business logic, no Prisma calls, no Redis calls in a controller.

```typescript
@Controller('bookings') // global prefix /v1 already applied in main.ts
export class BookingController {
  constructor(
    private readonly listMyBookings: ListMyBookingsUseCase,
    private readonly getBookingDetail: GetBookingDetailUseCase,
    private readonly createBooking: CreateBookingUseCase,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  list(
    @Query() query: ListBookingsDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PaginatedResponse<BookingSummary>> {
    return this.listMyBookings.execute(user.sub, query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  detail(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<BookingDetail> {
    return this.getBookingDetail.execute(id, user.sub);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Body() dto: CreateBookingDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<BookingDetail> {
    return this.createBooking.execute(dto, user.sub);
  }
}
```

**Rules:**
- `@Controller('<plural-resource>')` — always plural, kebab-case. The `/v1` prefix is applied globally in `main.ts`; do not repeat it.
- `@Get()`, `@Post()`, etc. — no path on collection endpoints
- `@Get(':id')` — `:id` for single resource, not `:bookingId`
- Each handler is **one logical line** that returns `useCase.execute(...)` (or wraps it for cookie/header side-effects, like the auth controller does for refresh-token cookies)
- Return raw domain objects. The global `TransformInterceptor` adds the `{ success, data }` envelope.
- Throw NestJS exceptions inside the use case; never construct error responses in the controller.

### 3.3 Use-Case Pattern (Canonical)

**This is the official architectural pattern for every feature module from Phase 3 onwards.** It mirrors `backend/src/modules/auth/`. Any new module that diverges will be rejected in review.

#### 3.3.1 Folder layout (mandatory)

Every feature module **must** match this layout exactly:

```
src/modules/<feature>/
  <feature>.module.ts          # imports kernel modules; providers list every use case
  <feature>.controller.ts      # thin: DTO in → useCase.execute() → return
  dto/
    <action>.dto.ts            # one DTO per file, class-validator decorators
    index.ts                   # barrel
  interfaces/
    <thing>.interface.ts       # plain TS types
    index.ts                   # barrel using `export type`
  use-cases/
    <action>.use-case.ts       # one @Injectable() class per endpoint
    index.ts                   # barrel
  utils/                       # only when stateless helpers exist
    <helper>.util.ts           # pure functions (mappers, calculators)
    index.ts                   # barrel
  strategies/                  # only when Passport strategies live in this module
    <name>.strategy.ts
```

**Rules:**
- Every subfolder has an `index.ts` barrel.
- **No `<feature>.service.ts` files.** Per-endpoint logic lives in use cases.
- A single feature may have helper use cases that other use cases consume (e.g. `GenerateTokensUseCase` is used by `RegisterUseCase`, `LoginUseCase`, `RefreshTokenUseCase` in the auth module). This is allowed and encouraged when the helper would otherwise be duplicated.

#### 3.3.2 Use-case class shape (mandatory)

```typescript
import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ErrorCode } from '../../../common/errors/error-codes';
import type { CreateBookingDto } from '../dto';
import type { BookingDetail } from '../interfaces';

@Injectable()
export class CreateBookingUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly events: EventEmitter2,
  ) {}

  async execute(dto: CreateBookingDto, userId: string): Promise<BookingDetail> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Check availability
      const overlap = await tx.booking.findFirst({
        where: {
          guideId: dto.guideId,
          status: 'CONFIRMED',
          startDate: { lte: dto.endDate },
          endDate: { gte: dto.startDate },
          deletedAt: null,
        },
      });
      if (overlap) {
        throw new ConflictException({
          code: ErrorCode.BKNG_DATES_UNAVAILABLE,
          message: 'Selected dates are not available',
        });
      }

      // 2. Create booking
      const booking = await tx.booking.create({
        data: { ...dto, userId, status: 'HOLD' },
      });

      // 3. Set hold in Redis (15-min TTL)
      await this.redis.setex(`booking_hold:${booking.id}`, 900, '1');

      // 4. Emit domain event (fire-and-forget)
      this.events.emit('booking.created', { bookingId: booking.id, userId });

      return booking;
    });
  }
}
```

**Rules:**
1. **One class per endpoint, one public method named `execute()`.** No additional public methods. Private helpers may exist but a future refactor should move them to `utils/` once they are reused.
2. **Decorated with `@Injectable()`.**
3. **Constructor-only DI.** Inject `PrismaService`, `RedisService`, shared kernel services (e.g. `CachedService`, `EventEmitter2`, `ConfigService`, `JwtService`), or **other use cases** in the same module. Never inject a feature service (none exist).
4. **Return domain types**, not Prisma row types. If translation/mapping is required, call a pure function in `utils/` (e.g. `mapBookingDetail(row)`).
5. **Errors:** throw NestJS exceptions with the structured payload `{ code: ErrorCode.XXX, message }`. The `ErrorCode` registry is at `src/common/errors/error-codes.ts` — match the `AUTH_*` style used in auth use cases.
6. **Imports:** relative paths only — `../../prisma/prisma.service`, `../../redis/redis.service`, `../../../common/errors/error-codes`, `../utils`, `../dto`, `../interfaces`. Use `import type` for DTO/interface types so the compile output stays clean.
7. **No private state on the class.** Use cases are stateless beyond the injected dependencies.

#### 3.3.3 When two endpoints share logic

- **Pure logic** (date math, mapping, formatting): extract into `utils/<name>.util.ts` as a pure function. Both use cases import it.
- **Stateful logic** that needs DI (e.g. token generation): extract into a dedicated use case (e.g. `GenerateTokensUseCase`) and inject it into both consumers. This is the pattern used by `RegisterUseCase` / `LoginUseCase` / `RefreshTokenUseCase` in auth.

#### 3.3.4 Caching inside a use case

When an endpoint is cacheable, use the shared `CachedService` from the kernel (`src/common/cache/`). Do **not** call Redis directly for read-through caching:

```typescript
async execute(id: string, lang: Lang): Promise<TripDetail> {
  return this.cache.getOrSet(tripDetailKey(id, lang), 600, async () => {
    const row = await this.prisma.trip.findFirst({ where: { id, deletedAt: null } });
    if (!row) throw new NotFoundException({ code: ErrorCode.TRP_NOT_FOUND, message: 'Trip not found' });
    return mapTripDetail(row, lang);
  });
}
```

#### 3.3.5 Reference implementation

`backend/src/modules/auth/` is the canonical reference. When in doubt, copy its structure:
- `auth.module.ts` — provider list
- `auth.controller.ts` — thin handlers, cookies handled in the controller, business logic delegated
- `use-cases/register.use-case.ts` — single-responsibility execute
- `use-cases/generate-tokens.use-case.ts` — helper use case consumed by other use cases
- `use-cases/index.ts` — barrel
- `dto/`, `interfaces/`, `utils/` — per-folder `index.ts` barrels

### 3.4 DTO Patterns
One DTO file per module. Use `class-validator` decorators:

```typescript
export class CreateBookingDto {
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @IsUUID()
  @IsOptional()
  linkedTripBookingId?: string;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  specialRequests?: string;
}
```

**Rules:**
- All fields must have a type annotation
- Use `@IsOptional()` for optional fields, never `| undefined` without it
- Validation decorators must match the type (`@IsString()` for strings, `@IsNumber()` for numbers)
- No business logic in DTOs — pure data + validation

### 3.5 Exception Handling
Never throw raw `Error` or `Error` subclasses. Use NestJS exceptions:

```typescript
import {
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
```

Map Prisma errors in the global exception filter, not in use cases:

```typescript
// In global filter — NOT in a use case
if (error.code === 'P2002') {
  throw new ConflictException(ErrorCode.DUPLICATE_ENTRY);
}
if (error.code === 'P2025') {
  throw new NotFoundException(ErrorCode.RECORD_NOT_FOUND);
}
```

---

## 4. Database Patterns

### 4.1 Prisma Queries
Always specify fields, never SELECT *:

```typescript
// Good
const user = await this.prisma.user.findUnique({
  where: { id },
  select: { id: true, email: true, name: true },
});

// Bad
const user = await this.prisma.user.findUnique({ where: { id } });
```

### 4.2 Transactions
Use `$transaction` for multi-write operations:

```typescript
await this.prisma.$transaction(async (tx) => {
  const booking = await tx.booking.create({ data: { ... } });
  await tx.payment.create({ data: { bookingId: booking.id, ... } });
});
```

### 4.3 No Raw SQL for Writes
Raw queries are read-only. All writes go through Prisma Client for type safety and hooks.

### 4.4 Soft Delete
Every query on soft-deletable tables must filter `deletedAt: null`:

```typescript
const user = await this.prisma.user.findUnique({
  where: { id, deletedAt: null },
});
```

Or use a Prisma middleware to inject this automatically.

---

## 5. Testing Patterns

### 5.1 Test File Location
Tests are colocated with the use case they cover. Each use case ships with its own `*.use-case.spec.ts`:

```
src/modules/booking/
  booking.module.ts
  booking.controller.ts
  use-cases/
    create-booking.use-case.ts
    create-booking.use-case.spec.ts        # unit test (colocated)
    get-booking-detail.use-case.ts
    get-booking-detail.use-case.spec.ts
    index.ts
  dto/                                     # ...
  interfaces/                              # ...
test/
  booking.e2e-spec.ts                      # E2E test
```

**Rule:** No `<feature>.service.spec.ts` files. The unit-test target is the use case, not a service. The reference implementation is `src/modules/auth/use-cases/*.use-case.spec.ts`.

### 5.2 Test Naming
```typescript
describe('CreateBookingUseCase', () => {
  describe('execute', () => {
    it('should create a booking when dates are available', async () => {
      // ...
    });

    it('should throw ConflictException when dates overlap', async () => {
      // ...
    });

    it('should set Redis hold with 900s TTL', async () => {
      // ...
    });
  });
});
```

**Rules:**
- `describe` = use case (or shared kernel class) under test
- inner `describe` = `execute` (or other public method)
- `it` = specific behavior, starting with "should"
- One assertion concept per test (may have multiple `expect` calls)

### 5.3 Mocking
Mock external services, never mock Prisma for integration tests:

```typescript
// Good — mock external service
const mockStripe = { paymentIntents: { create: jest.fn() } };

// Bad — mock Prisma in integration test
const mockPrisma = { booking: { create: jest.fn() } };
```

For unit tests, mock Prisma. For integration tests, use a test database.

### 5.4 Test Database
- E2E tests use a separate Postgres database
- Database is wiped (`prisma migrate reset --force`) before each E2E suite
- Seed data is loaded for consistent test state

---

## 6. Async Patterns

### 6.1 Promises
Always `await` or explicitly void promises. No floating promises:

```typescript
// Good
await this.createBooking.execute(dto, userId);

// Good — explicitly fire-and-forget
void this.backgroundTask.run();

// Bad — floating promise
this.createBooking.execute(dto, userId); // ESLint error
```

### 6.2 Error Handling in Async
Use try/catch or `.catch()` for async operations that may fail:

```typescript
// Good
try {
  await this.externalApi.call();
} catch (error) {
  this.logger.error('External API failed', error);
  throw new ServiceUnavailableException();
}

// Good — fire-and-forget with error handling
void this.backgroundTask.run().catch((err) => {
  this.logger.error('Background task failed', err);
});
```

### 6.3 Parallel Execution
Use `Promise.all` for independent async operations:

```typescript
const [user, bookings] = await Promise.all([
  this.getUserProfile.execute(userId),
  this.listMyBookings.execute(userId, { page: 1, limit: 20 }),
]);
```

---

## 7. Logging

### 7.1 Logger Injection
Use NestJS built-in logger or Pino:

```typescript
@Injectable()
export class CreateBookingUseCase {
  private readonly logger = new Logger(CreateBookingUseCase.name);

  async execute(dto: CreateBookingDto, userId: string): Promise<BookingDetail> {
    this.logger.log(`Creating booking for user ${userId}`);
    // ...
  }
}
```

### 7.2 What to Log
- **INFO:** Business events (booking created, payment completed)
- **WARN:** Degraded state (retry attempt, cache miss, slow query)
- **ERROR:** Failures requiring attention (DB connection lost, payment failed)
- **DEBUG:** Development-only diagnostics

### 7.3 What NOT to Log
- Passwords, tokens, API keys
- PII (email, phone, passport numbers)
- Payment card numbers, CVV
- Request bodies containing sensitive data

Use Pino redaction:

```typescript
redact: {
  paths: ['req.headers.authorization', 'req.body.password', 'req.body.token'],
  remove: true,
}
```

---

## 8. Git Practices

### 8.1 Commit Message Format
Conventional Commits:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
```
feat(booking): add Redis hold mechanism for guide bookings
fix(payment): handle Stripe webhook duplicate events
refactor(auth): extract token rotation into separate method
test(booking): add E2E for double-booking conflict
```

### 8.2 Branch Naming
```
feature/F12-booking-hold
fix/BKNG-001-overbooking-race
refactor/payment-service
docs/api-contract
```

### 8.3 PR Checklist
Every PR must:
- [ ] Pass `npm run lint`
- [ ] Pass `npm run format:check`
- [ ] Pass `npm run test` (unit)
- [ ] Pass `npm run test:e2e` (if touching critical paths)
- [ ] Update relevant `.md` spec if behavior changes
- [ ] Add/update tests for new behavior
- [ ] No `console.log` — use `Logger` instead

---

## 9. Code Review Rules

### 9.1 Reviewer Responsibilities
- Verify the code follows this document
- Check for missing tests on new logic
- Verify error handling paths
- Check for N+1 queries
- Verify no secrets in code

### 9.2 Author Responsibilities
- Self-review before requesting review
- Run full test suite locally
- Provide context in PR description (what, why, how)
- Link to relevant spec document if behavior is specified there

### 9.3 Approval Requirements
- 1 approval for bug fixes, docs, refactors
- 2 approvals for new features, API changes, auth/payment changes

---

## 10. Documentation

### 10.1 When to Add Comments
- Non-obvious business rules ("refund is 0% within 3 days due to vendor policy")
- Workarounds for known issues ("Stripe webhook may arrive out of order")
- Complex algorithms with mathematical basis
- NEVER comment what the code does — the code should be self-documenting

### 10.2 When to Update Specs
- API behavior changes → update `api.yaml` and `API-CONTRACT.md`
- New error code → update `ERROR-REGISTRY.md`
- New event → update `EVENT-CATALOG.md`
- Database schema changes → update `SCHEMA.md` and regenerate Prisma Client

### 10.3 Swagger Documentation
All controllers must have `@ApiTags`, `@ApiOperation`, `@ApiResponse`:

```typescript
@ApiTags('Bookings')
@Controller('v1/bookings')
export class BookingController {
  @Post()
  @ApiOperation({ summary: 'Create a booking' })
  @ApiResponse({ status: 201, description: 'Booking created', type: BookingResponse })
  @ApiResponse({ status: 409, description: 'Dates unavailable' })
  async create(@Body() dto: CreateBookingDto): Promise<ApiResponse<Booking>> {
    // ...
  }
}
```

---

## 11. Security Checklist

Every PR touching these areas must verify:

- [ ] **Auth:** JWT validation on all protected endpoints
- [ ] **Auth:** Refresh tokens stored in httpOnly Secure SameSite=Strict cookies
- [ ] **Auth:** Passwords hashed with bcrypt cost 12
- [ ] **Input:** All user input validated via `class-validator`
- [ ] **Input:** No raw SQL concatenation with user input
- [ ] **Output:** No sensitive data in error messages to client
- [ ] **Output:** Rate limiting applied to auth and payment endpoints
- [ ] **Payment:** Stripe webhook signatures verified
- [ ] **Payment:** Idempotency key checked before processing
- [ ] **AI:** `X-Service-Key` validated on all `/v1/ai-tools/*` endpoints
- [ ] **Secrets:** No hardcoded keys, tokens, or URLs

---

## 12. Performance Rules

- [ ] Database queries use `select` to fetch only needed fields
- [ ] List endpoints have pagination (default 20, max 50)
- [ ] N+1 queries eliminated via `include` or raw joins
- [ ] Redis caching for public GET endpoints (respect `x-nfr-cache-ttl`)
- [ ] No synchronous file I/O in request path
- [ ] Images served from CDN/Supabase Storage, not the API

---

## Enforcement

| Tool | What it enforces | When it runs |
|------|-----------------|--------------|
| ESLint | Code quality, import order, no unused vars | Pre-commit, CI |
| Prettier | Formatting | Pre-commit, CI |
| TypeScript | Type safety | Build, CI |
| Jest | Tests pass, coverage gates | CI |
| Husky (optional) | Runs lint + format + test on commit | Git pre-commit |

**Rule:** CI is red until all tools pass. No exceptions.
