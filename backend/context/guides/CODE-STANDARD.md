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
import { BookingService } from './booking.service';
import { CreateBookingDto } from './booking.dto';
```

**Rule:** No `../../..` paths deeper than two levels. Use absolute imports for cross-module references.

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
Service public methods must declare return types:

```typescript
// Good
async findById(id: string): Promise<Booking | null> {
  return this.prisma.booking.findUnique({ where: { id } });
}

// Bad — inference hides the contract
async findById(id: string) {
  return this.prisma.booking.findUnique({ where: { id } });
}
```

Private methods may omit return types if inference is obvious.

### 2.5 Null Handling
Always handle the null case explicitly:

```typescript
// Good
const booking = await this.bookingService.findById(id);
if (!booking) {
  throw new NotFoundException(ErrorCode.BOOKING_NOT_FOUND);
}

// Bad — implicit null dereference
const booking = await this.bookingService.findById(id);
return booking.status; // may throw at runtime
```

Use optional chaining when appropriate:

```typescript
const name = user?.profile?.name ?? 'Guest';
```

---

## 3. NestJS Patterns

### 3.1 Module Structure
Every feature module is a self-contained unit:

```typescript
@Module({
  imports: [PrismaModule, RedisModule], // only common modules
  controllers: [BookingController],
  providers: [BookingService],
  exports: [BookingService], // only if other modules need it (rare)
})
export class BookingModule {}
```

**Rule:** Feature modules do NOT import other feature modules. Cross-feature communication via events or Prisma relations only.

### 3.2 Controller Patterns
One controller per module. Routes are resource-based:

```typescript
@Controller('v1/bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Get()
  async findAll(@Query() query: ListBookingsDto): Promise<PaginatedResponse<BookingSummary>> {
    return this.bookingService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ApiResponse<BookingDetail>> {
    const booking = await this.bookingService.findById(id);
    if (!booking) {
      throw new NotFoundException(ErrorCode.BOOKING_NOT_FOUND);
    }
    return { success: true, data: booking };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() dto: CreateBookingDto,
    @CurrentUser() user: UserPayload,
  ): Promise<ApiResponse<Booking>> {
    const booking = await this.bookingService.create(dto, user.id);
    return { success: true, data: booking };
  }
}
```

**Rules:**
- `@Controller('v1/<plural-resource>')` — always plural, kebab-case
- `@Get()`, `@Post()`, etc. — no path on collection endpoints
- `@Get(':id')` — `:id` for single resource, not `:bookingId`
- Return `ApiResponse<T>` wrapper, not raw data
- Throw NestJS exceptions; never return error objects manually

### 3.3 Service Patterns
Services contain business logic. Controllers only delegate:

```typescript
@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateBookingDto, userId: string): Promise<Booking> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Check availability
      const isAvailable = await this.checkAvailability(tx, dto);
      if (!isAvailable) {
        throw new ConflictException(ErrorCode.BOOKING_UNAVAILABLE);
      }

      // 2. Create booking
      const booking = await tx.booking.create({
        data: { ...dto, userId, status: BookingStatus.HOLD },
      });

      // 3. Set hold in Redis
      await this.redis.setex(`booking_hold:${booking.id}`, 900, '1');

      // 4. Emit event (non-blocking)
      this.eventEmitter.emit('booking.created', { bookingId: booking.id, userId });

      return booking;
    });
  }
}
```

**Rules:**
- Constructor injection only, no property injection
- Business logic lives in service methods, not controllers
- Database writes happen inside `$transaction` when multiple tables involved
- Events are fire-and-forget (no `await` on `emit()`)
- Services return domain types, not Prisma types (map if needed)

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

Map Prisma errors in the global exception filter, not in services:

```typescript
// In global filter — NOT in service
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
```
src/booking/
  booking.service.ts
  booking.service.spec.ts        # unit test (colocated)
  booking.controller.spec.ts     # unit test
test/
  booking.e2e-spec.ts            # E2E test
```

### 5.2 Test Naming
```typescript
describe('BookingService', () => {
  describe('create', () => {
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
- `describe` = class or method under test
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
await this.service.doSomething();

// Good — explicitly fire-and-forget
void this.backgroundTask.doSomething();

// Bad — floating promise
this.service.doSomething(); // ESLint error
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
  this.userService.findById(userId),
  this.bookingService.findByUser(userId),
]);
```

---

## 7. Logging

### 7.1 Logger Injection
Use NestJS built-in logger or Pino:

```typescript
@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  async create(dto: CreateBookingDto): Promise<Booking> {
    this.logger.log(`Creating booking for user ${dto.userId}`);
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
