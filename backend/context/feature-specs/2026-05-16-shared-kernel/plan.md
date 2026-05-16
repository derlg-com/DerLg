# Shared Kernel — Implementation Plan

> Task groups for Track 1 (1.1–1.13). Groups are ordered by dependency but can run in parallel where noted.

---

## Task Group 1: Core Infrastructure Modules (1.1–1.3)

> **Parallel-safe with Group 4.** Groups 2 and 3 depend on this.

### 1.1 ConfigModule — Environment Validation
- Install `@nestjs/config`, `joi`
- Create `src/config/config.module.ts` with `ConfigModule.forRoot({ isGlobal: true, validationSchema: ... })`
- Joi schema validates all required env vars from `TECH-STACK.md` §Environment Variables
- Missing required var → `process.exit(1)` with clear error message
- Export `ConfigService` wrapper for typed access

### 1.2 PrismaModule — Global Database Singleton
- Verify `@prisma/client` is installed
- Create `src/prisma/prisma.module.ts` — `@Global()`, exports `PrismaService`
- Create `src/prisma/prisma.service.ts` — extends `PrismaClient`, implements `OnModuleInit` + `OnModuleDestroy`
- Register in `AppModule` imports

### 1.3 RedisModule + RedisService
- Install `ioredis`
- Create `src/redis/redis.module.ts` — `@Global()`, exports `RedisService`
- Create `src/redis/redis.service.ts` — typed wrapper around ioredis
  - `get(key: string): Promise<string | null>`
  - `set(key: string, value: string, ttl?: number): Promise<void>`
  - `del(key: string): Promise<void>`
  - `setex(key: string, seconds: number, value: string): Promise<void>`
  - `keys(pattern: string): Promise<string[]>` for debugging
- Handle connection errors with retry (`maxRetriesPerRequest: 3`)
- Use Redis key conventions from `CONSTITUTION.md` §3.3

---

## Task Group 2: Request / Response Pipeline (1.4–1.7)

> **Depends on Group 1.** Can parallelize 1.4–1.5 with 1.6–1.7 once Group 1 is done.

### 1.4 Global ValidationPipe
- Install `class-validator`, `class-transformer`
- Configure in `main.ts`:
  ```typescript
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  ```
- Verify: invalid DTO → 400 with `VAL_INVALID_INPUT`

### 1.5 Global Exception Filters
- Create `src/common/filters/prisma.filter.ts`
  - `P2002` → `ConflictException` (`DUPLICATE_ENTRY`)
  - `P2025` → `NotFoundException` (`RECORD_NOT_FOUND`)
  - `P2003` → `ConflictException` (foreign key violation)
- Create `src/common/filters/all-exceptions.filter.ts`
  - Catch-all → 500 with `INTERNAL_ERROR`
  - Log stack trace server-side, send generic message to client
- Register both in `main.ts` via `app.useGlobalFilters()`

### 1.6 TransformInterceptor — Response Envelope
- Create `src/common/interceptors/transform.interceptor.ts`
- Wrap every response into `{ success: true, data: T }`
- Controllers return raw data (not manually wrapped) per `CODE-STANDARD.md` §3.2
- Skip wrapping if already wrapped (idempotent)
- Skip for health endpoint (`/health`) if plain response required

### 1.7 LoggingInterceptor — Pino Structured Logging
- Install `pino`, `pino-http`, `nestjs-pino`
- Configure in `main.ts` with `LoggerModule.forRoot({ ... })`
- Redact: `req.headers.authorization`, `req.body.password`, `req.body.token`
- Log format: `{ req: { id, method, url }, res: { statusCode }, responseTime }`
- Use correlation ID from `X-Request-ID` header

---

## Task Group 3: Security Layer (1.8–1.9, 1.12–1.13)

> **Depends on Group 1.** Can run in parallel with Group 2.

### 1.8 JwtAuthGuard + RolesGuard
- Install `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `bcrypt`
- Create `src/common/guards/jwt-auth.guard.ts`
  - Extends `AuthGuard('jwt')`
  - Handle `@Public()` decorator — skip JWT check
- Create `src/common/guards/roles.guard.ts`
  - Reads `@Roles()` metadata
  - 403 if role mismatch

### 1.9 Decorators
- Create `src/common/decorators/public.decorator.ts` — `@Public()`
- Create `src/common/decorators/roles.decorator.ts` — `@Roles(...roles)`
- Create `src/common/decorators/current-user.decorator.ts` — `@CurrentUser()`
  - Extracts user payload from request (set by JWT strategy)

### 1.12 Throttler — Redis Store
- Install `@nestjs/throttler`
- Configure in `AppModule` with `ThrottlerModule.forRootAsync()` (v6 API):
  ```typescript
  ThrottlerModule.forRootAsync({
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: () => [
      { name: 'default', ttl: 60000, limit: 10 },
      { name: 'auth', ttl: 300000, limit: 5 },
      { name: 'payment', ttl: 60000, limit: 3 },
    ],
  })
  ```
- Apply `@SkipThrottle()` or `@Throttle()` decorators on controllers/endpoints per `CONSTITUTION.md` §4.3
- Return `RATE_LIMIT_EXCEEDED` on 429
- Use a custom `ThrottlerStorage` implementation backed by `RedisService` for distributed rate limiting across instances

### 1.13 Helmet + CORS
- Install `helmet`
- Configure in `main.ts`:
  ```typescript
  app.use(helmet({ contentSecurityPolicy: false })); // API only
  app.enableCors({ origin: configService.get('CORS_ORIGINS').split(',') });
  ```
- Verify security headers present on all responses

---

## Task Group 4: Types & Contracts (1.10–1.11)

> **Parallel-safe with Group 1.** No runtime dependencies.

### 1.10 Pagination DTO + Response Types
- Create `src/common/dto/pagination.dto.ts`
  - `page` (default 1, min 1)
  - `limit` (default 20, min 1, max 50)
- Create `src/common/types/api-response.type.ts`
  ```typescript
  export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    message?: string;
    error?: { code: string; message: string; details?: Record<string, unknown> };
  }
  ```
- Create `src/common/types/paginated-response.type.ts`
  ```typescript
  export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }
  ```

### 1.11 ErrorCodes Registry — Full Const Object
- Create `src/common/errors/error-codes.ts`
- Include **all ~100 codes** from `ERROR-REGISTRY.md`, organized by domain:
  - Generic: `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`, `CONFLICT`, `UNPROCESSABLE_ENTITY`, `DUPLICATE_ENTRY`, `RECORD_NOT_FOUND`
  - Auth: `AUTH_*` (11 codes)
  - Validation: `VAL_*` (10 codes)
  - Rate Limit: `RATE_LIMIT_EXCEEDED`
  - User: `USR_*` (3 codes)
  - Trip: `TRIP_*` (3 codes)
  - Place: `PLACE_*` (2 codes)
  - Hotel: `HTL_*` (4 codes)
  - Guide: `GDE_*` (4 codes)
  - Transport: `TRNS_*` (2 codes)
  - Booking: `BKNG_*` (10 codes)
  - Payment: `PAY_*` (10 codes)
  - Review: `REV_*` (6 codes)
  - Favorite: `FAV_*` (3 codes)
  - Search: `SRCH_*` (2 codes)
  - Student: `STD_*` (4 codes)
  - Loyalty: `LYL_*` (3 codes)
  - Emergency: `EMRG_*` (5 codes)
  - Discount: `DSC_*` (4 codes)
  - AI: `AI_*` (4 codes)
- Code members: `SCREAMING_SNAKE_CASE`
- Export a const object + type for tree-shaking (per `CODE-STANDARD.md` §2.3)

---

## Wiring in AppModule + main.ts

After all groups complete, wire modules in `src/app.module.ts` using the `.forRoot()` / `.forRootAsync()` configurations defined in each task above.

Then update `main.ts`:

```typescript
import { Logger } from 'nestjs-pino';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.useGlobalPipes(new ValidationPipe({ ... }));
  app.useGlobalFilters(new PrismaFilter(), new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor(), new LoggingInterceptor());
  app.use(helmet({ contentSecurityPolicy: false }));
  app.enableCors({ origin: configService.get('CORS_ORIGINS').split(',') });
  await app.listen(3001);
}
```

---

## Package Install List

Exact versions from `TECH-STACK.md`:

```bash
# Core
npm install @nestjs/config@^11.0.0 joi

# Validation
npm install class-validator@^0.14.0 class-transformer@^0.5.0

# Auth
npm install @nestjs/jwt@^11.0.0 @nestjs/passport@^11.0.0 passport@^0.7.0 passport-jwt@^4.0.0 bcrypt@^5.0.0
npm install -D @types/passport-jwt

# Redis / Throttling
npm install ioredis@^5.0.0 @nestjs/throttler@^6.0.0

# Logging
npm install pino@^9.0.0 pino-http@^10.0.0 nestjs-pino@^4.0.0

# Security
npm install helmet@^8.0.0
```

**Note:** `ioredis` v5 and `bcrypt` v5 include their own TypeScript definitions. Do **not** install `@types/ioredis` or `@types/bcrypt`.

---

## Execution Order

```
Group 1 (1.1–1.3) ──┬──► Group 2 (1.4–1.7)
                     │
Group 4 (1.10–1.11) ─┴──► Group 3 (1.8–1.9, 1.12–1.13)
                              │
                              ▼
                        Final wiring (AppModule, main.ts)
```

Groups 1 and 4 can start immediately in parallel.
Groups 2 and 3 can start once Group 1 is done.
Final wiring happens after all groups complete.
