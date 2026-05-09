# DerLg.com Backend — Combined Specification (Task + Requirements + Design)

> **Purpose:** This file merges `tasks.md`, `requirements.md`, and `design.md` into a single implementation-ready reference. Each task block lists its sub-steps, extracted acceptance criteria, relevant design patterns, a code/change summary, and a verification checklist.

---

## Task: 1 — Project Setup and Core Infrastructure

### 1. From tasks.md
- **Sub-steps:**
  - Initialize NestJS project with TypeScript strict mode
  - Configure Prisma with Supabase PostgreSQL connection
  - Set up Redis client for Upstash integration
  - Create centralized configuration module with environment validation
  - Implement global exception filters (HTTP and Prisma errors)
  - Set up global validation pipe with class-validator
  - Configure CORS with whitelist for production domains
  - Set up Winston logger with structured logging
  - Integrate Sentry for error tracking
  - Create health check endpoint at /health
- **Requirements:** 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 25.1, 25.3, 25.4, 25.5, 25.6

### 2. From requirements.md
- **Req 1.1:** Backend SHALL use NestJS 10 with TypeScript
- **Req 1.2:** Organize code into feature modules (auth, users, trips, bookings, payments, transportation, hotels, guides, explore, festivals, emergency, student-discount, loyalty, notifications, currency, ai-tools)
- **Req 1.3:** Use centralized config module that reads environment variables
- **Req 1.4:** Store all sensitive config in environment variables (DATABASE_URL, DIRECT_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, AI_SERVICE_KEY, REDIS_URL)
- **Req 1.5:** Use Prisma as ORM with schema in prisma/schema.prisma
- **Req 1.6:** Connect to Supabase PostgreSQL via connection pooler for runtime queries
- **Req 1.7:** Connect via direct connection for migrations
- **Req 1.8:** Global exception filters for HTTP and Prisma errors
- **Req 1.9:** Global validation pipe using class-validator
- **Req 1.10:** CORS enabled for whitelisted origins only (https://derlg.com, https://www.derlg.com)
- **Req 25.1:** Listen on port 3001 in production
- **Req 25.3:** Implement Winston logger for structured logging
- **Req 25.4:** Integrate with Sentry for error tracking
- **Req 25.5:** Expose health check endpoint at /health
- **Req 25.6:** Log all unhandled exceptions with full stack traces

### 3. From design.md
- **Pattern:** Modular NestJS architecture; `src/config/config.module.ts` + `config.service.ts` + `env.validation.ts`
- **Files:**
  ```
  src/main.ts
  src/app.module.ts
  src/config/config.module.ts
  src/config/config.service.ts
  src/config/env.validation.ts
  src/common/filters/http-exception.filter.ts
  src/common/filters/prisma-exception.filter.ts
  src/common/pipes/validation.pipe.ts
  src/prisma/prisma.module.ts
  src/prisma/prisma.service.ts
  src/redis/redis.module.ts
  src/redis/redis.service.ts
  ```
- **Interface:**
  ```typescript
  // CORS config (main.ts)
  app.enableCors({
    origin: ['https://derlg.com', 'https://www.derlg.com',
      ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : [])],
    credentials: true,
    methods: ['GET','POST','PUT','PATCH','DELETE'],
    allowedHeaders: ['Content-Type','Authorization','X-Service-Key']
  });

  // Graceful shutdown
  app.enableShutdownHooks();
  process.on('SIGTERM', async () => { await app.close(); process.exit(0); });
  ```

### 4. Implementation Summary
- Bootstrap NestJS 10 app; strict TypeScript; global pipes, filters, interceptors applied in `main.ts`
- `ConfigModule` validates env vars at startup and throws descriptive errors for missing values
- `PrismaService` extends `PrismaClient`, hooks into `onModuleInit`/`onModuleDestroy`
- `RedisService` wraps Upstash Redis client with `get`, `set`, `setex`, `del`, `incr`, `expire`, `publish`, `subscribe`
- Winston transports: file (error.log), file (combined.log), console
- Sentry initialized with `dsn`, `environment`, `tracesSampleRate: 0.1`
- Health check controller at `/health` queries Prisma (`SELECT 1`) and Redis (`set`/`del`)

### 5. Verification
- [ ] `npm run start` succeeds without env errors
- [ ] `GET /health` returns `{ status: "healthy" }` within 100 ms
- [ ] Request to non-whitelisted origin returns no CORS headers
- [ ] Invalid env var at startup produces clear error message

---

## Task: 2.1 — Define Prisma Schema With All 18 Models

### 1. From tasks.md
- **Sub-steps:**
  - Create User, Trip, Place, Hotel, HotelRoom models
  - Create TransportationVehicle and Guide models
  - Create Booking, Payment, Review, Festival, DiscountCode models
  - Create LoyaltyTransaction, EmergencyAlert, StudentVerification models
  - Create Notification, AISession, AuditLog models
  - Define all ENUM types
  - Add indexes on frequently queried columns
- **Requirements:** 2.1–2.9

### 2. From requirements.md
- **Req 2.1:** 18 database models (users, trips, places, hotels, hotel_rooms, transportation_vehicles, guides, bookings, payments, reviews, festivals, discount_codes, loyalty_transactions, emergency_alerts, student_verifications, notifications, ai_sessions, audit_logs)
- **Req 2.2:** UUID primary keys for all tables
- **Req 2.3:** Proper foreign key relationships
- **Req 2.4:** Indexes on email, booking_ref, user_id, status, travel_date, supabase_uid
- **Req 2.5:** ENUM types (UserRole, Language, Environment, BookingStatus, BookingType, PaymentStatus, PaymentMethod)
- **Req 2.6:** Monetary values as DECIMAL(10,2)
- **Req 2.7:** JSONB for itinerary, includes, excludes, cancellation_policy, customizations
- **Req 2.8:** TEXT[] arrays for mood_tags, highlights, amenities, features, languages
- **Req 2.9:** TIMESTAMPTZ for timestamps with auto created_at / updated_at

### 3. From design.md
- **Pattern:** Prisma schema file at `prisma/schema.prisma`; snake_case column names with `@map`; `@@map` for table names
- **Files:** `prisma/schema.prisma`, `prisma/migrations/`
- **Interface (key models):**
  ```prisma
  enum UserRole { USER ADMIN SUPPORT }
  enum Language { EN KH ZH }
  enum BookingType { PACKAGE HOTEL_ONLY TRANSPORT_ONLY GUIDE_ONLY }
  enum BookingStatus { RESERVED CONFIRMED CANCELLED COMPLETED REFUNDED }
  enum PaymentStatus { PENDING SUCCEEDED FAILED REFUNDED PARTIALLY_REFUNDED }
  enum PaymentMethod { CARD QR_CODE }
  enum AlertType { SOS MEDICAL THEFT LOST }
  enum AlertStatus { SENT ACKNOWLEDGED RESOLVED }

  model User {
    id            String   @id @default(uuid())
    supabaseUid   String   @unique @map("supabase_uid")
    email         String   @unique
    loyaltyPoints Int      @default(0) @map("loyalty_points")
    tokenVersion  Int      @default(0) @map("token_version")
    @@index([email]) @@index([supabaseUid]) @@map("users")
  }

  model Booking {
    subtotalUsd Decimal @map("subtotal_usd") @db.Decimal(10,2)
    totalUsd    Decimal @map("total_usd")    @db.Decimal(10,2)
    customizations Json?
    reservedUntil  DateTime? @map("reserved_until")
    @@index([userId]) @@index([bookingRef]) @@index([status]) @@index([travelDate])
    @@map("bookings")
  }

  model Payment {
    stripePaymentIntentId String @unique @map("stripe_payment_intent_id")
    stripeEventId         String? @unique @map("stripe_event_id")
    amountUsd             Decimal @map("amount_usd") @db.Decimal(10,2)
    @@map("payments")
  }
  ```

### 4. Implementation Summary
- Full `prisma/schema.prisma` with all 18 models, enums, relations, indexes
- Connection: `DATABASE_URL` (pooler) + `DIRECT_URL` (direct) using `datasource db { shadowDatabaseUrl }`

### 5. Verification
- [ ] `npx prisma validate` passes with no errors
- [ ] All 18 models present; all ENUM types defined
- [ ] Indexes exist on all required columns

---

## Task: 2.2 — Write Property Test: JSON Validation on Parse (Property 54)

### 1. From tasks.md
- **Sub-steps:** Write property-based test for JSON validation
- **Requirements:** 26.1, 26.2, 26.3, 26.8

### 2. From requirements.md
- **Req 26.1:** Parsing booking customizations JSON SHALL validate against expected schema
- **Req 26.2:** Parsing trip itinerary JSON SHALL validate against expected schema
- **Req 26.3:** Parsing cancellation policy JSON SHALL validate against expected schema
- **Req 26.8:** When parsing fails, return descriptive error with field location

### 3. From design.md
- **Pattern:** `fast-check` property-based tests; `{ numRuns: 100 }`; comment tag `Feature: backend-nestjs-supabase, Property 54`
- **Interface:**
  ```typescript
  import * as fc from 'fast-check';
  // Property 54: JSON validation on parse
  it('should validate JSON structure', async () => {
    await fc.assert(fc.asyncProperty(fc.anything(), async (input) => {
      if (!isValidSchema(input)) {
        await expect(service.parseJson(input)).rejects.toMatchObject({ field: expect.any(String) });
      }
    }), { numRuns: 100 });
  });
  ```

### 4. Implementation Summary
- Test file: `src/bookings/bookings.service.spec.ts` (property section)
- Generate arbitrary objects with fast-check; assert invalid schemas produce errors with `field` location

### 5. Verification
- [ ] Property test runs 100 iterations without seed failures
- [ ] Invalid JSON input returns error object containing `field` key

---

## Task: 2.3 — Generate Prisma Migrations

### 1. From tasks.md
- **Sub-steps:** Run `prisma migrate dev`, verify tables/indexes/constraints created
- **Requirements:** 2.10

### 2. From requirements.md
- **Req 2.10:** Generate Prisma migrations for all schema changes

### 3. From design.md
- **Pattern:** `npx prisma migrate dev --name init`; separate `DIRECT_URL` for migrations
- **Files:** `prisma/migrations/TIMESTAMP_init/migration.sql`

### 4. Implementation Summary
- Run `npx prisma migrate dev` against direct connection
- Commit generated migration SQL to version control

### 5. Verification
- [ ] Migration SQL file created under `prisma/migrations/`
- [ ] `npx prisma migrate status` shows all migrations applied
- [ ] All tables visible in `npx prisma studio`

---

## Task: 3.1 — Create Shared Decorators

### 1. From tasks.md
- **Sub-steps:** `@CurrentUser()`, `@Roles()`, `@ServiceKey()` decorators
- **Requirements:** 3.7, 3.13

### 2. From requirements.md
- **Req 3.7:** Access token payload includes sub (user_id), role, email, preferred_language
- **Req 3.13:** Apply role-based authorization guard for admin-only routes

### 3. From design.md
- **Files:** `src/common/decorators/current-user.decorator.ts`, `roles.decorator.ts`, `service-key.decorator.ts`
- **Interface:**
  ```typescript
  export const CurrentUser = createParamDecorator(
    (data: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user
  );
  export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);
  ```

### 4. Implementation Summary
- `CurrentUser` extracts `request.user` (set by JwtStrategy)
- `Roles` sets metadata consumed by `RolesGuard`
- `ServiceKey` marks endpoints requiring `X-Service-Key` header

### 5. Verification
- [ ] `@CurrentUser()` returns JWT payload in controller
- [ ] `@Roles(UserRole.ADMIN)` routes reject non-admin users with 403

---

## Task: 3.2 — Create Authentication Guards

### 1. From tasks.md
- **Sub-steps:** `JwtAuthGuard`, `RolesGuard`, `ServiceKeyGuard`
- **Requirements:** 3.12, 3.13, 19.2, 19.3

### 2. From requirements.md
- **Req 3.12:** JWT auth guard on all protected routes
- **Req 3.13:** Role-based guard for admin-only endpoints
- **Req 19.2:** AI tools endpoints protected with Service Key authentication guard
- **Req 19.3:** Validate `X-Service-Key` header on all AI tool requests

### 3. From design.md
- **Files:** `src/common/guards/jwt-auth.guard.ts`, `roles.guard.ts`, `service-key.guard.ts`
- **Interface:**
  ```typescript
  @Injectable()
  export class JwtAuthGuard extends AuthGuard('jwt') {
    handleRequest(err, user, info) {
      if (err || !user) throw new UnauthorizedException('Invalid or expired token');
      return user;
    }
  }

  @Injectable()
  export class ServiceKeyGuard implements CanActivate {
    canActivate(ctx: ExecutionContext): boolean {
      const key = ctx.switchToHttp().getRequest().headers['x-service-key'];
      if (!key || key !== this.configService.get('AI_SERVICE_KEY'))
        throw new UnauthorizedException('Invalid service key');
      return true;
    }
  }
  ```

### 4. Implementation Summary
- `JwtAuthGuard` extends Passport `AuthGuard('jwt')` and maps errors to `UnauthorizedException`
- `RolesGuard` reads `roles` metadata via `Reflector` and compares with `request.user.role`
- `ServiceKeyGuard` validates `X-Service-Key` header against `AI_SERVICE_KEY` env var

### 5. Verification
- [ ] Protected route returns 401 without valid JWT
- [ ] Admin route returns 403 for non-admin user
- [ ] AI tools route returns 401 with invalid service key

---

## Task: 3.3 — Create Interceptors

### 1. From tasks.md
- **Sub-steps:** `ResponseTransformInterceptor`, `LoggingInterceptor`, `AuditInterceptor`
- **Requirements:** 23.1, 23.2, 36.6

### 2. From requirements.md
- **Req 23.1:** Wrap all successful responses in envelope `{ success: true, data, message }`
- **Req 23.2:** Wrap all error responses in `{ success: false, data: null, message, error }`
- **Req 36.6:** Maintain audit log of all data access and modifications

### 3. From design.md
- **Files:** `src/common/interceptors/response-transform.interceptor.ts`, `logging.interceptor.ts`, `audit.interceptor.ts`
- **Interface:**
  ```typescript
  // AuditInterceptor masks sensitive data
  private maskSensitiveData(data: any): any {
    const sensitive = ['password', 'cardNumber', 'cvv', 'ssn'];
    // replace sensitive fields with '***MASKED***'
  }
  ```

### 4. Implementation Summary
- `ResponseTransformInterceptor` maps observable to `{ success: true, data: result, message: 'OK' }`
- `AuditInterceptor` logs method, url, userId, sanitized body, ip, timestamp to `audit_logs` table

### 5. Verification
- [ ] All successful API responses contain `success: true` and `data` fields
- [ ] `password` field is masked in audit logs

---

## Task: 3.4 — Create Exception Filters

### 1. From tasks.md
- **Sub-steps:** `HttpExceptionFilter`, `PrismaExceptionFilter`
- **Requirements:** 1.8, 23.3, 23.5

### 2. From requirements.md
- **Req 1.8:** Global exception filters for HTTP and Prisma errors
- **Req 23.3:** Include machine-readable error codes in error responses
- **Req 23.5:** Use correct HTTP status codes

### 3. From design.md
- **Files:** `src/common/filters/http-exception.filter.ts`, `prisma-exception.filter.ts`
- **Interface:**
  ```typescript
  // PrismaExceptionFilter maps Prisma error codes:
  // P2002 → 409 DUPLICATE_RECORD
  // P2025 → 404 NOT_FOUND
  // P2003 → 400 INVALID_REFERENCE

  interface ErrorResponse {
    success: false; data: null; message: string;
    error: { code: string; details?: Record<string, any>; };
  }
  ```

### 4. Implementation Summary
- `HttpExceptionFilter` extracts `code` from exception response object or derives from class name
- `PrismaExceptionFilter` maps Prisma `P20xx` codes to HTTP statuses and error codes

### 5. Verification
- [ ] Unique constraint violation returns 409 with `DUPLICATE_RECORD` code
- [ ] Record not found returns 404 with `NOT_FOUND` code

---

## Task: 3.5 — Write Property Tests: Rate Limit & Expired Token (Properties 59, 60)

### 1. From tasks.md
- **Sub-steps:** Property tests for rate limit response and expired token error code
- **Requirements:** 34.9, 34.10

### 2. From requirements.md
- **Req 34.9:** Requests exceeding rate limit return 429 with `retry-after` header
- **Req 34.10:** Expired JWT returns 401 with error code `TOKEN_EXPIRED`

### 3. From design.md
- **Pattern:** fast-check property tests with `{ numRuns: 100 }`
- **Interface:**
  ```typescript
  // Property 59
  it('rate limit response includes retry-after', async () => {
    await fc.assert(fc.asyncProperty(fc.integer({ min: 61, max: 200 }), async (reqCount) => {
      // simulate reqCount requests; assert 429 + retry-after header on last
    }), { numRuns: 100 });
  });
  ```

### 4. Implementation Summary
- Mock Redis counter to return value > limit; assert response status 429 and `retry-after` header present
- Mock JWT with past `exp`; assert 401 response body has `error.code === 'TOKEN_EXPIRED'`

### 5. Verification
- [ ] Property 59 passes 100 runs
- [ ] Property 60 passes 100 runs

---

## Task: 4.1 — Implement Authentication Service

### 1. From tasks.md
- **Sub-steps:** `register()`, `login()`, `refreshAccessToken()`, `logout()`, Google OAuth, password reset
- **Requirements:** 3.1–3.11

### 2. From requirements.md
- **Req 3.1:** Registration creates Supabase Auth account
- **Req 3.2:** Registration creates user record in `users` table with `supabase_uid` linked
- **Req 3.3:** Require email verification before first login
- **Req 3.4:** Login generates JWT access token with 15-minute expiry
- **Req 3.5:** Login generates JWT refresh token with 7-day expiry
- **Req 3.6:** Refresh tokens stored in httpOnly Secure SameSite=Strict cookies
- **Req 3.7:** Access token payload: `sub` (user_id), `role`, `email`, `preferred_language`
- **Req 3.8:** Refresh validates token version; issues new access token
- **Req 3.9:** Logout increments token version to invalidate all tokens
- **Req 3.10:** Support Google OAuth via Passport strategy
- **Req 3.11:** Password reset via Supabase Auth `resetPasswordForEmail`

### 3. From design.md
- **Files:** `src/auth/auth.service.ts`, `src/auth/strategies/jwt.strategy.ts`, `src/auth/strategies/google.strategy.ts`
- **Interface:**
  ```typescript
  interface AuthService {
    register(dto: RegisterDto): Promise<AuthResponse>;
    login(dto: LoginDto): Promise<AuthResponse>;
    loginWithGoogle(token: string): Promise<AuthResponse>;
    refreshAccessToken(refreshToken: string): Promise<AuthResponse>;
    logout(userId: string): Promise<void>;
    requestPasswordReset(email: string): Promise<void>;
    resetPassword(token: string, newPassword: string): Promise<void>;
    generateAccessToken(user: User): string;
    generateRefreshToken(user: User): string;
    validateRefreshToken(token: string): Promise<TokenPayload>;
    incrementTokenVersion(userId: string): Promise<void>;
  }

  interface AuthResponse {
    success: boolean;
    data: { user: UserDto; accessToken: string; refreshToken: string; };
    message: string;
  }
  ```

### 4. Implementation Summary
- `register()`: call `supabase.auth.signUp()`, create `users` row, return token pair
- `login()`: call `supabase.auth.signInWithPassword()`, generate tokens, store refresh version in Redis
- `refreshAccessToken()`: decode refresh token, compare `tokenVersion` with Redis, issue new access token
- `logout()`: call `incrementTokenVersion()` → `redis.set('refresh_token_version:{userId}', version+1)`
- Tokens: `JWT_ACCESS_SECRET` (15 min), `JWT_REFRESH_SECRET` (7 days)

### 5. Verification
- [ ] `POST /v1/auth/register` creates Supabase user + `users` row
- [ ] `POST /v1/auth/login` returns `accessToken` and sets httpOnly cookie
- [ ] `POST /v1/auth/logout` invalidates all subsequent refresh requests

---

## Task: 4.2 — Create Authentication Controller

### 1. From tasks.md
- **Sub-steps:** Register, login, refresh, logout, google, reset-password endpoints; rate limiting
- **Requirements:** 3.14

### 2. From requirements.md
- **Req 3.14:** Rate-limit auth endpoints to 5 requests per 5 minutes per IP

### 3. From design.md
- **Files:** `src/auth/auth.controller.ts`, `src/auth/dto/register.dto.ts`, `login.dto.ts`, `refresh-token.dto.ts`
- **Interface:**
  ```
  POST /v1/auth/register
  POST /v1/auth/login
  POST /v1/auth/refresh
  POST /v1/auth/logout
  POST /v1/auth/google
  POST /v1/auth/reset-password
  ```

### 4. Implementation Summary
- Apply `@Throttle(5, 300)` (5 per 300 s) to all auth controller routes
- `RegisterDto` validates email, password (regex), name, phone, preferredLanguage

### 5. Verification
- [ ] 6th auth request within 5 minutes from same IP returns 429

---

## Task: 4.3 — Implement JWT Strategies

### 1. From tasks.md
- **Sub-steps:** `JwtStrategy`, `GoogleStrategy`; configure token expiry
- **Requirements:** 3.4, 3.5, 3.10

### 2. From requirements.md
- **Req 3.4:** Access token 15-minute expiry
- **Req 3.5:** Refresh token 7-day expiry
- **Req 3.10:** Support Google OAuth login

### 3. From design.md
- **Files:** `src/auth/strategies/jwt.strategy.ts`, `src/auth/strategies/google.strategy.ts`
- **Pattern:** Passport `PassportStrategy(Strategy)`; extract token from `Authorization: Bearer` header

### 4. Implementation Summary
- `JwtStrategy` uses `secretOrKey: JWT_ACCESS_SECRET`; `validate()` returns user payload
- `GoogleStrategy` uses `clientID`, `clientSecret`, `callbackURL`; maps Google profile to user

### 5. Verification
- [ ] Valid access token passes `JwtAuthGuard`
- [ ] Expired token is rejected with 401

---

## Task: 4.4 — Write Property Tests: Authentication (Properties 1–8)

### 1. From tasks.md
- **Sub-steps:** Properties 1–8
- **Requirements:** 3.1, 3.2, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.12, 3.13, 3.14

### 2. From requirements.md
- **Property 1:** Registration creates Supabase account + users row
- **Property 2:** Login generates access token (15 min) + refresh token (7 day) in httpOnly cookie
- **Property 3:** Access token contains sub, role, email, preferred_language
- **Property 4:** Valid refresh token → new valid access token
- **Property 5:** Logout causes all existing tokens to be rejected
- **Property 6:** Protected route without JWT → 401
- **Property 7:** Admin-only route with non-admin user → 403
- **Property 8:** >5 auth requests in 5 minutes → 429 on 6th

### 3. From design.md
- **Pattern:**
  ```typescript
  const email = fc.emailAddress();
  const password = fc.string({ minLength: 8 }).filter(s => /[A-Z]/.test(s) && /[0-9]/.test(s));
  await fc.assert(fc.asyncProperty(fc.record({ email, password, name: fc.string() }), async (data) => {
    const result = await authService.register(data);
    expect(result.data.user.id).toBeDefined();
  }), { numRuns: 100 });
  ```

### 4. Implementation Summary
- 8 property tests in `src/auth/auth.service.spec.ts` covering all auth correctness properties

### 5. Verification
- [ ] All 8 property tests pass with 100 runs each

---

## Task: 5.1 — Implement Users Service

### 1. From tasks.md
- **Sub-steps:** `getProfile()`, `updateProfile()`, `uploadAvatar()`; 5 MB limit
- **Requirements:** 4.1–4.8

### 2. From requirements.md
- **Req 4.1:** Return current user profile data when authenticated
- **Req 4.2:** Validate and save profile changes to users table
- **Req 4.3:** Allow updates to name, phone, avatar_url, preferred_language, emergency_contact_name, emergency_contact_phone
- **Req 4.4:** Prevent modification of loyalty_points, is_student, student_verified_at, role
- **Req 4.5:** Return loyalty_points in profile response
- **Req 4.6:** Return student verification status (is_student, student_verified_at)
- **Req 4.7:** Store avatar in Supabase Storage and save URL
- **Req 4.8:** Enforce maximum 5 MB for avatar uploads
- **Req 4.9:** Support EN, KH, ZH language preferences

### 3. From design.md
- **Files:** `src/users/users.service.ts`, `src/users/users.controller.ts`, `src/users/dto/update-profile.dto.ts`
- **Interface:**
  ```typescript
  // updateProfile strips protected fields before DB update
  const { loyaltyPoints, isStudent, studentVerifiedAt, role, ...safeData } = dto;
  await this.prisma.user.update({ where: { id: userId }, data: safeData });
  ```

### 4. Implementation Summary
- `getProfile()` returns user with `loyaltyPoints`, `isStudent`, `studentVerifiedAt`
- `uploadAvatar()` validates file size ≤ 5 MB, calls `supabase.storage.from('avatars').upload()`, saves URL
- `updateProfile()` uses `UpdateProfileDto` that omits protected fields via `@IsOptional` + whitelist

### 5. Verification
- [ ] PATCH profile with `role: 'ADMIN'` in body is ignored
- [ ] Avatar upload > 5 MB returns 413
- [ ] Profile response always includes `loyaltyPoints`

---

## Task: 5.2 — Create Users Controller

### 1. From tasks.md
- **Sub-steps:** GET profile, PATCH profile, POST avatar endpoints
- **Requirements:** 4.1, 4.2, 4.7

### 2. From requirements.md
- **Req 4.1:** Return current user profile when authenticated
- **Req 4.2:** Validate and save changes
- **Req 4.7:** Upload avatar to Supabase Storage

### 3. From design.md
- **Files:** `src/users/users.controller.ts`
- **Interface:**
  ```
  GET  /v1/users/profile  @UseGuards(JwtAuthGuard)
  PATCH /v1/users/profile  @UseGuards(JwtAuthGuard)
  POST /v1/users/avatar    @UseGuards(JwtAuthGuard) @UseInterceptors(FileInterceptor('avatar'))
  ```

### 4. Implementation Summary
- Use `@CurrentUser()` to extract userId from JWT; pass to service methods
- `FileInterceptor` configured with `multer` for multipart/form-data

### 5. Verification
- [ ] GET /v1/users/profile without JWT → 401
- [ ] POST /v1/users/avatar with file > 5 MB → 413

---

## Task: 5.3 — Write Property Tests: User Management (Properties 9–12)

### 1. From tasks.md
- **Sub-steps:** Properties 9–12
- **Requirements:** 4.2, 4.4, 4.5, 4.6, 4.7

### 2. From requirements.md
- **Property 9:** Valid profile updates are persisted and reflected in subsequent GET
- **Property 10:** Protected fields remain unchanged after update
- **Property 11:** Profile response includes loyalty_points and student verification status
- **Property 12:** Avatar upload stores image; returned URL matches stored URL

### 3. From design.md
- **Pattern:** Generate arbitrary valid update DTOs; verify protected fields unchanged; verify round-trip URL

### 4. Implementation Summary
- Property tests in `src/users/users.service.spec.ts`

### 5. Verification
- [ ] All 4 property tests pass with 100 runs

---

## Task: 6.1 — Implement Trips Service

### 1. From tasks.md
- **Sub-steps:** `getTrips()` with all filters, `getTripById()`, `getFeaturedTrips()`
- **Requirements:** 5.1–5.10

### 2. From requirements.md
- **Req 5.1:** List active trips with pagination
- **Req 5.2:** Filter by environment (MOUNTAIN, BEACH, CITY, FOREST, ISLAND, TEMPLE)
- **Req 5.3:** Filter by duration range (min_days, max_days)
- **Req 5.4:** Filter by price range (min_price_usd, max_price_usd)
- **Req 5.5:** Filter by province
- **Req 5.6:** Sort by price, rating, or duration
- **Req 5.7:** Return content in requested language (title_kh, title_zh)
- **Req 5.8:** Featured trips ordered by average rating
- **Req 5.9:** Include hotel, transport, itinerary details in trip response
- **Req 5.10:** Only return trips where `is_active = true`

### 3. From design.md
- **Files:** `src/trips/trips.service.ts`, `src/trips/dto/trip-filter.dto.ts`
- **Interface:**
  ```typescript
  interface TripFilterDto {
    environment?: Environment;
    minDays?: number; maxDays?: number;
    minPrice?: number; maxPrice?: number;
    province?: string;
    sortBy?: 'price' | 'rating' | 'duration';
    language?: Language;
    page?: number; perPage?: number;
  }
  ```

### 4. Implementation Summary
- Prisma query uses `where: { isActive: true, ...filters }` with `orderBy` and `skip`/`take` for pagination
- `getTripById()` includes `hotel`, `transportVehicle`, `itinerary` via Prisma `include`

### 5. Verification
- [ ] Trips with `is_active = false` never appear in results
- [ ] `sortBy: 'price'` returns trips in ascending price order

---

## Task: 6.2 — Create Trips Controller

### 1. From tasks.md
- **Sub-steps:** GET /v1/trips, GET /v1/trips/:id, GET /v1/trips/featured; Accept-Language header
- **Requirements:** 5.1, 5.7

### 2. From requirements.md
- **Req 5.1:** Paginated list
- **Req 5.7:** Content in requested language

### 3. From design.md
- **Files:** `src/trips/trips.controller.ts`
- **Interface:**
  ```
  GET /v1/trips          (query: TripFilterDto + Accept-Language)
  GET /v1/trips/featured
  GET /v1/trips/:id
  ```

### 4. Implementation Summary
- Extract `Accept-Language` header via `@Headers('accept-language')`; pass to service
- Response envelope includes `pagination` metadata

### 5. Verification
- [ ] `Accept-Language: kh` returns `title_kh` in response

---

## Task: 6.3 — Write Property Tests: Trip Catalog (Properties 13–21)

### 1. From tasks.md
- **Sub-steps:** Properties 13–21
- **Requirements:** 5.1–5.10

### 2. From requirements.md
- **Property 13:** Total items across all pages equals total count in metadata
- **Property 14:** All returned trips match requested environment filter
- **Property 15:** All trip durations within [min_days, max_days] inclusive
- **Property 16:** All trip prices within [min_price, max_price] inclusive
- **Property 17:** All trips match requested province
- **Property 18:** Trips correctly ordered by sortBy field
- **Property 19:** Response includes title in requested language
- **Property 20:** No inactive trips in results
- **Property 21:** Trip detail includes hotel, transport, itinerary

### 3. From design.md
- **Pattern:** Arbitrary environment type from `fc.constantFrom(...)`, price ranges via `fc.float()`

### 4. Implementation Summary
- 9 property tests in `src/trips/trips.service.spec.ts`

### 5. Verification
- [ ] All 9 property tests pass with 100 runs

---

## Task: 7 — Checkpoint — Ensure All Tests Pass

### 1. From tasks.md
- Ensure all tests pass; ask user if questions arise

### 2. Verification
- [ ] `npm test` passes all unit + property tests
- [ ] No TypeScript compilation errors

---

## Task: 8.1 — Implement Bookings Service Core Logic

### 1. From tasks.md
- **Sub-steps:** `generateBookingRef()`, `calculateBookingPrice()`, `applyDiscounts()`, booking hold, `checkAvailability()`, pessimistic locking
- **Requirements:** 6.1–6.4, 6.5–6.9, 6.15

### 2. From requirements.md
- **Req 6.1:** Booking ref format: `DLG-YYYY-NNNN`
- **Req 6.2:** Initial status: `RESERVED`
- **Req 6.3:** `reserved_until` = now + 15 minutes
- **Req 6.4:** Subtotal = sum of base prices for selected resources
- **Req 6.5:** Apply discount codes if provided and valid
- **Req 6.6:** Apply loyalty points discount if requested
- **Req 6.7:** Apply student discount if user is verified student
- **Req 6.8:** Final `total_usd` = subtotal minus all discounts
- **Req 6.9:** Store `booking_hold:{booking_id}` in Redis with 15-minute TTL
- **Req 6.15:** Validate availability before creating booking

### 3. From design.md
- **Files:** `src/bookings/bookings.service.ts`
- **Interface:**
  ```typescript
  interface BookingService {
    createBooking(userId: string, dto: CreateBookingDto): Promise<Booking>;
    checkAvailability(dto: AvailabilityCheckDto): Promise<AvailabilityResponse>;
    calculateBookingPrice(dto: CreateBookingDto): Promise<PriceBreakdown>;
    applyDiscounts(subtotal: number, discounts: DiscountDto[]): Promise<number>;
    generateBookingRef(): string;
  }

  interface PriceBreakdown {
    subtotal: number;
    discounts: { type: string; amount: number; }[];
    total: number;
  }
  ```
- **Pattern (pessimistic locking):**
  ```typescript
  return await this.prisma.$transaction(async (tx) => {
    const isAvailable = await this.checkAvailability(...);
    if (!isAvailable) throw new ConflictException('Resource not available');
    return tx.booking.create({ data: { ...bookingData, status: 'RESERVED',
      reservedUntil: new Date(Date.now() + 15 * 60 * 1000) } });
  }, { isolationLevel: 'Serializable' });
  ```
- **Redis key:**
  ```
  booking_hold:{bookingId} = JSON({ bookingId, userId, expiresAt })  TTL: 900s
  ```

### 4. Implementation Summary
- `generateBookingRef()` queries DB for current year count, pads to 4 digits
- `checkAvailability()` queries CONFIRMED or unexpired RESERVED bookings with date overlap
- `applyDiscounts()` chains discount code → loyalty points → student discount; validates each
- Serializable transaction prevents race conditions

### 5. Verification
- [ ] Booking ref matches `/^DLG-\d{4}-\d{4}$/`
- [ ] `redis.get('booking_hold:{id}')` returns value with TTL ≈ 900 s
- [ ] Concurrent booking attempt for same resource: exactly one succeeds

---

## Task: 8.2 — Implement Booking Lifecycle Methods

### 1. From tasks.md
- **Sub-steps:** `createBooking()`, `confirmBooking()`, `cancelBooking()`, `getUserBookings()`, `getBookingByRef()`
- **Requirements:** 6.10–6.13

### 2. From requirements.md
- **Req 6.10:** Payment success → status = `CONFIRMED`
- **Req 6.11:** Hold expiry → status = `CANCELLED`
- **Req 6.12:** Users view their own bookings only
- **Req 6.13:** Users can cancel CONFIRMED bookings per cancellation policy

### 3. From design.md
- **State Machine:** `RESERVED → CONFIRMED` (payment) | `RESERVED → CANCELLED` (expiry/cancel) | `CONFIRMED → CANCELLED/REFUNDED`
- **Pattern:** `getUserBookings()` always filters by `where: { userId }` (req 6.12)

### 4. Implementation Summary
- `cancelBooking()` validates `travelDate > now` before allowing cancel; calls `refundService.processRefund()`
- `getBookingByRef()` ensures `userId` match; throws 404 if not found

### 5. Verification
- [ ] `GET /v1/bookings` never returns bookings belonging to another user
- [ ] Cancel attempt after travel date returns 400 `TRIP_ALREADY_STARTED`

---

## Task: 8.3 — Create Bookings Controller

### 1. From tasks.md
- **Sub-steps:** POST, GET list, GET by ref, POST cancel, GET availability endpoints
- **Requirements:** 6.1, 6.12, 6.13, 6.15

### 2. From requirements.md
- **Req 6.1:** Create booking
- **Req 6.12:** User sees own bookings
- **Req 6.13:** Cancel CONFIRMED bookings

### 3. From design.md
- **Files:** `src/bookings/bookings.controller.ts`, `src/bookings/dto/create-booking.dto.ts`, `cancel-booking.dto.ts`
- **Interface:**
  ```
  POST /v1/bookings
  GET  /v1/bookings  ?status=&bookingType=&page=&perPage=
  GET  /v1/bookings/:bookingRef
  POST /v1/bookings/:id/cancel
  GET  /v1/bookings/:id/availability
  ```
- **CreateBookingDto:**
  ```typescript
  export class CreateBookingDto {
    @IsEnum(BookingType) bookingType: BookingType;
    @IsUUID() @IsOptional() tripId?: string;
    @IsDateString() travelDate: string;
    @IsInt() @Min(1) @Max(20) numAdults: number;
    @IsInt() @Min(0) @Max(10) numChildren: number;
    @IsString() @IsOptional() @MaxLength(50) @Matches(/^[A-Z0-9]+$/) discountCode?: string;
    @IsInt() @Min(0) @IsOptional() loyaltyPointsToRedeem?: number;
  }
  ```

### 4. Implementation Summary
- All endpoints guarded by `JwtAuthGuard`; userId extracted via `@CurrentUser()`
- Response includes `priceBreakdown` on creation

### 5. Verification
- [ ] POST /v1/bookings returns 201 with `booking.status === 'RESERVED'`
- [ ] POST /v1/bookings/:id/cancel returns refund details

---

## Task: 8.4 — Write Property Tests: Booking Management (Properties 22–30, 55, 57)

### 1. From tasks.md
- **Sub-steps:** Properties 22, 23, 24, 25, 26, 27, 28, 29, 30, 55, 57
- **Requirements:** 6.1–6.15, 26.6, 34.4

### 2. From requirements.md
- **Property 22:** Booking ref matches `DLG-YYYY-NNNN`
- **Property 23:** New booking status = RESERVED; reserved_until = now + 15 min
- **Property 24:** Subtotal = sum of resource base prices
- **Property 25:** total_usd = subtotal − all applicable discounts
- **Property 26:** Redis key `booking_hold:{id}` with TTL ≈ 900 s exists
- **Property 27:** Payment success webhook transitions booking to CONFIRMED
- **Property 28:** Background job cancels expired RESERVED bookings
- **Property 29:** User booking list only contains own bookings
- **Property 30:** Double booking attempt fails with `RESOURCE_UNAVAILABLE`
- **Property 55:** Booking JSON serialization round-trip preserves all fields
- **Property 57:** Concurrent bookings: exactly one succeeds

### 3. From design.md
- **Pattern:**
  ```typescript
  const futureDate = fc.date({ min: new Date(), max: new Date(Date.now() + 2*365*24*3600*1000) });
  ```

### 4. Implementation Summary
- 11 property tests in `src/bookings/bookings.service.spec.ts`

### 5. Verification
- [ ] All 11 property tests pass with 100 runs

---

## Task: 9.1 — Implement Transportation Service

### 1. From tasks.md
- **Sub-steps:** `getVehicles()`, `checkVehicleAvailability()`, `calculateTransportPrice()`
- **Requirements:** 7.1–7.10

### 2. From requirements.md
- **Req 7.1:** Filter by category (VAN, BUS, TUK_TUK)
- **Req 7.2:** Filter by minimum capacity
- **Req 7.3:** Filter by tier (STANDARD, VIP)
- **Req 7.4–7.5:** Availability check; return available status + calculated price
- **Req 7.6–7.7:** Validate availability on booking creation; calculate price by duration
- **Req 7.8:** Per-day pricing for vans and buses
- **Req 7.9:** Per-km pricing for tuk-tuks
- **Req 7.10:** Include vehicle features and images in response

### 3. From design.md
- **Files:** `src/transportation/transportation.service.ts`, `transportation.controller.ts`

### 4. Implementation Summary
- `calculateTransportPrice()` branches on `category`; `pricePerDay * days` for VAN/BUS, `pricePerKm * km` for TUK_TUK
- Availability uses same date-overlap query as bookings

### 5. Verification
- [ ] TUK_TUK price calculation uses per-km rate
- [ ] Unavailable vehicle returns conflict error

---

## Task: 10.1 — Implement Hotels Service

### 1. From tasks.md
- **Sub-steps:** `getHotels()`, `getHotelRooms()`, `checkRoomAvailability()`, `calculateHotelPrice()`
- **Requirements:** 8.1–8.8

### 2. From requirements.md
- **Req 8.1:** List hotels by province
- **Req 8.2:** List rooms by room_type, capacity, price range
- **Req 8.3–8.4:** Availability check and validation on booking
- **Req 8.5:** Price = nightly rate × number of nights
- **Req 8.6–8.7:** Include hotel amenities, star_rating, images; room amenities, capacity
- **Req 8.8:** Enforce check-in / check-out time policies

### 3. From design.md
- **Files:** `src/hotels/hotels.service.ts`, `src/hotels/hotels.controller.ts`

### 4. Implementation Summary
- `calculateHotelPrice()` = `room.pricePerNight * nights`; nights = `(checkOut - checkIn) / 86400000`
- `checkRoomAvailability()` queries bookings with `hotelRoomId` and date overlap

### 5. Verification
- [ ] Hotel listing filters by province
- [ ] Price calculation for 3 nights at $100/night = $300

---

## Task: 11.1 — Implement Guides Service

### 1. From tasks.md
- **Sub-steps:** `getGuides()`, `checkGuideAvailability()`, `calculateGuidePrice()`
- **Requirements:** 9.1–9.8

### 2. From requirements.md
- **Req 9.1–9.3:** Filter by languages, specialties, province
- **Req 9.4–9.5:** Availability check and validation
- **Req 9.6:** Price based on number of days
- **Req 9.7:** Only verified and available guides
- **Req 9.8:** Include bio in requested language, certifications, ratings

### 3. From design.md
- **Files:** `src/guides/guides.service.ts`, `src/guides/guides.controller.ts`

### 4. Implementation Summary
- `getGuides()` uses `where: { isVerified: true, isAvailable: true }` + language/specialty array filters
- `calculateGuidePrice()` = `guide.dailyRate * days`

### 5. Verification
- [ ] Unverified guides never appear in results
- [ ] Language filter returns only guides speaking requested language

---

## Task: 12.1 — Implement Payments Service Core Logic

### 1. From tasks.md
- **Sub-steps:** `createPaymentIntent()`; validate booking; amount independence; create payment record; extend hold TTL
- **Requirements:** 10.1–10.6

### 2. From requirements.md
- **Req 10.1:** Validate booking exists and status = RESERVED
- **Req 10.2:** Verify `reserved_until` not expired
- **Req 10.3:** Calculate amount independently from booking data (never trust client)
- **Req 10.4:** Create Stripe Payment Intent with booking metadata
- **Req 10.5:** Create payment record with status PENDING
- **Req 10.6:** Return `client_secret` to frontend

### 3. From design.md
- **Files:** `src/payments/payments.service.ts`
- **Interface:**
  ```typescript
  interface PaymentService {
    createPaymentIntent(bookingId: string, userId: string): Promise<PaymentIntentResponse>;
  }
  interface PaymentIntentResponse {
    clientSecret: string; amount: number; currency: string; expiresAt: Date;
  }
  ```
- **Pattern:** Amount always computed from DB: `booking.totalUsd * 100` (convert to cents); never from request body

### 4. Implementation Summary
- Fetch booking by ID; verify `status === 'RESERVED'` and `reservedUntil > new Date()`
- Call `stripe.paymentIntents.create({ amount, currency: 'usd', metadata: { bookingId } })`
- Create `Payment` row with `status: PENDING`, `stripePaymentIntentId`
- Extend Redis TTL: `redis.expire('booking_hold:{bookingId}', 900)`

### 5. Verification
- [ ] Payment intent for expired booking returns 400 `BOOKING_EXPIRED`
- [ ] Payment record created with PENDING status
- [ ] Amount in Stripe matches booking `total_usd` × 100

---

## Task: 12.2 — Implement QR Payment Generation

### 1. From tasks.md
- **Sub-steps:** `generateQRPayment()`; QR code image; expiry matching hold time
- **Requirements:** 10.7–10.9

### 2. From requirements.md
- **Req 10.7:** Create payment intent with QR-compatible payment method
- **Req 10.8:** Generate QR code image URL
- **Req 10.9:** Set QR expiry to match booking hold time

### 3. From design.md
- **Interface:**
  ```typescript
  interface QRPaymentResponse {
    qrCodeUrl: string; paymentIntentId: string; amount: number; expiresAt: Date;
  }
  ```

### 4. Implementation Summary
- Generate QR code using `qrcode` library; upload PNG to Supabase Storage; return public URL
- `expiresAt = booking.reservedUntil`

### 5. Verification
- [ ] QR code URL is publicly accessible
- [ ] `expiresAt` matches `booking.reservedUntil`

---

## Task: 12.3 — Implement Webhook Processing

### 1. From tasks.md
- **Sub-steps:** Signature verification, idempotency, handle payment succeeded/failed/refunded; publish to Redis pub/sub
- **Requirements:** 10.11–10.19

### 2. From requirements.md
- **Req 10.11:** Verify webhook signature using `STRIPE_WEBHOOK_SECRET`
- **Req 10.12:** Check `stripe_event_id` for idempotency
- **Req 10.13–10.17:** On `payment_intent.succeeded`: confirm booking, update payment, award loyalty points, send notification, publish Redis event
- **Req 10.18:** On `payment_intent.payment_failed`: update payment to FAILED
- **Req 10.19:** On `charge.refunded`: update payment and booking to REFUNDED

### 3. From design.md
- **Pattern (webhook flow):**
  ```typescript
  event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  if (await checkEventProcessed(event.id)) return { received: true };
  await prisma.$transaction(async (tx) => {
    await tx.booking.update({ data: { status: 'CONFIRMED' } });
    await tx.payment.update({ data: { status: 'SUCCEEDED', stripeEventId: event.id } });
    await loyaltyService.awardPoints(userId, amount, bookingId);
  });
  await redis.del('booking_hold:{bookingId}');
  await redis.publish('payment_events:{userId}', JSON.stringify({ event: 'payment_succeeded', bookingId, amount }));
  await notificationService.sendBookingConfirmation(booking);
  ```

### 4. Implementation Summary
- Atomic transaction ensures all-or-nothing processing
- `checkEventProcessed()` queries `Payment` table for `stripeEventId`
- Respond within 5 seconds (non-blocking notification sends)

### 5. Verification
- [ ] Duplicate webhook event returns 200 without reprocessing
- [ ] Booking status is CONFIRMED after successful webhook
- [ ] Loyalty points awarded (2 per USD) after payment

---

## Task: 12.4 — Create Payments Controller

### 1. From tasks.md
- **Sub-steps:** create-intent, qr-payment, webhook, refund endpoints; rate limiting
- **Requirements:** 10.10, 10.20

### 2. From requirements.md
- **Req 10.10:** Webhook at `/v1/payments/webhook` with no JWT auth
- **Req 10.20:** Rate-limit payment intent creation to 3 per minute per user

### 3. From design.md
- **Files:** `src/payments/payments.controller.ts`, `src/payments/webhooks.controller.ts`
- **Interface:**
  ```
  POST /v1/payments/create-intent  @UseGuards(JwtAuthGuard) @Throttle(3, 60)
  POST /v1/payments/qr-payment     @UseGuards(JwtAuthGuard)
  POST /v1/payments/webhook        (no auth; rawBody required)
  POST /v1/payments/:bookingId/refund @UseGuards(JwtAuthGuard)
  ```

### 4. Implementation Summary
- Webhook controller uses `@Req() req: RawBodyRequest<Request>` for signature verification
- Raw body enabled via `NestFactory.create(AppModule, { rawBody: true })`

### 5. Verification
- [ ] 4th payment intent request within 1 minute returns 429
- [ ] Webhook endpoint accessible without Authorization header

---

## Task: 12.5 — Write Property Tests: Payment Processing (Properties 31–40, 56)

### 1. From tasks.md
- **Sub-steps:** Properties 31–40, 56
- **Requirements:** 10.1–10.20, 26.7

### 2. From requirements.md
- **Property 31:** Payment intent rejected for non-RESERVED or expired booking
- **Property 32:** Stripe amount computed from DB, not client
- **Property 33:** PENDING payment record created on intent creation
- **Property 34:** Response includes `client_secret`
- **Property 35:** Invalid webhook signature → 400
- **Property 36:** Duplicate webhook event ID → idempotent 200
- **Property 37:** Succeeded webhook atomically: confirms booking, updates payment, awards points, notifies, publishes
- **Property 38:** Failed webhook → payment FAILED
- **Property 39:** Refunded webhook → payment + booking REFUNDED
- **Property 40:** >3 payment intent requests/minute → 429
- **Property 56:** Payment JSON serialization round-trip

### 3. From design.md
- **Pattern:** Mock Stripe; simulate webhook payloads with arbitrary payment intent IDs

### 4. Implementation Summary
- 11 property tests in `src/payments/payments.service.spec.ts`

### 5. Verification
- [ ] All 11 property tests pass with 100 runs

---

## Task: 13.1 — Implement Refund Service

### 1. From tasks.md
- **Sub-steps:** `processRefund()`, `calculateRefundAmount()`; create Stripe refund; update statuses; deduct loyalty points; send notification
- **Requirements:** 11.1–11.10

### 2. From requirements.md
- **Req 11.1–11.2:** Fetch cancellation policy; calculate days until travel date
- **Req 11.3:** 7+ days before: 100% refund
- **Req 11.4:** 1–7 days before: 50% refund
- **Req 11.5:** <24 hours before: 0% refund
- **Req 11.6:** Create Stripe refund with calculated amount
- **Req 11.7:** Update payment to REFUNDED or PARTIALLY_REFUNDED
- **Req 11.8:** Update booking to CANCELLED
- **Req 11.9:** Deduct loyalty points earned from booking
- **Req 11.10:** Send refund confirmation notification

### 3. From design.md
- **Refund flow sequence:** User → Backend → calculateDays → applyPolicy → Stripe refund → DB transaction → notification

### 4. Implementation Summary
  ```typescript
  const daysUntilTravel = Math.floor((booking.travelDate.getTime() - Date.now()) / 86400000);
  const refundPct = daysUntilTravel >= 7 ? 1.0 : daysUntilTravel >= 1 ? 0.5 : 0;
  const refundAmount = booking.totalUsd * refundPct;
  if (refundAmount > 0) await stripe.refunds.create({ payment_intent: payment.stripePaymentIntentId, amount: Math.round(refundAmount * 100) });
  ```
- DB transaction: update payment status, update booking to CANCELLED, call `loyaltyService.reversePoints()`

### 5. Verification
- [ ] 8-day advance cancel → 100% refund
- [ ] 3-day advance cancel → 50% refund
- [ ] 6-hour advance cancel → 0% refund
- [ ] Loyalty points deducted after refund

---

## Task: 13.2 — Write Property Tests: Refund Processing (Properties 41–46)

### 1. From tasks.md
- **Sub-steps:** Properties 41–46
- **Requirements:** 11.3–11.10

### 2. From requirements.md
- **Property 41:** Refund % matches cancellation policy thresholds for any travel date
- **Property 42:** Refund amount > 0 → Stripe refund created
- **Property 43:** Payment status = REFUNDED (full) or PARTIALLY_REFUNDED (partial)
- **Property 44:** Booking status = CANCELLED after refund
- **Property 45:** Loyalty points reversed; ADJUSTED transaction record created
- **Property 46:** Refund confirmation notification sent

### 3. From design.md
- **Pattern:** Generate arbitrary `travelDate` relative to now; verify refund percentage formula

### 4. Implementation Summary
- 6 property tests in `src/payments/refund.service.spec.ts`

### 5. Verification
- [ ] All 6 property tests pass with 100 runs

---

## Task: 14 — Checkpoint — Ensure All Tests Pass

### Verification
- [ ] `npm test` passes all tests
- [ ] No TypeScript errors

---

## Task: 15.1 — Implement Emergency Service

### 1. From tasks.md
- **Sub-steps:** `createAlert()`, province detection, `getNearestHospital()`, `updateAlertStatus()`, permanent records
- **Requirements:** 12.1–12.11

### 2. From requirements.md
- **Req 12.1:** Capture GPS coordinates (latitude, longitude, accuracy)
- **Req 12.2:** Store alert_type (SOS, MEDICAL, THEFT, LOST)
- **Req 12.3:** Initial status = SENT
- **Req 12.4:** Push notification to support team
- **Req 12.5:** SMS to support emergency line
- **Req 12.6:** Return support contact numbers
- **Req 12.7:** Return local police number based on GPS location
- **Req 12.8:** Return nearest hospital information
- **Req 12.9:** Allow support to update status to ACKNOWLEDGED or RESOLVED
- **Req 12.10:** Emergency alert records never deleted
- **Req 12.11:** Province-specific emergency contacts for all 25 Cambodia provinces

### 3. From design.md
- **Files:** `src/emergency/emergency.service.ts`, `src/emergency/emergency.controller.ts`, `src/emergency/dto/create-alert.dto.ts`
- **Interface:**
  ```typescript
  interface EmergencyService {
    createAlert(userId: string, dto: CreateAlertDto): Promise<EmergencyAlertResponse>;
    updateAlertStatus(alertId: string, status: AlertStatus): Promise<EmergencyAlert>;
    getEmergencyContacts(lat: number, lng: number): Promise<EmergencyContacts>;
    getNearestHospital(lat: number, lng: number): Promise<Hospital>;
    getProvinceFromCoordinates(lat: number, lng: number): Promise<string>;
  }

  interface CreateAlertDto {
    alertType: AlertType;
    latitude: number; longitude: number; accuracy: number;
    message?: string;
  }
  ```
- **Cambodian GPS bounds:** lat [10.0, 14.7], lng [102.3, 107.7]

### 4. Implementation Summary
- Province lookup uses coordinate bounding boxes for all 25 provinces
- Hospital lookup uses pre-seeded data sorted by Haversine distance
- `updateAlertStatus()` only updates `status` field; never deletes records
- Notification: FCM push to support topic + SMS via Twilio/similar

### 5. Verification
- [ ] Alert created with status SENT; GPS coordinates stored
- [ ] Response includes police number and nearest hospital
- [ ] Emergency alert records have no DELETE operations in service

---

## Task: 15.2 — Implement Location Sharing

### 1. From tasks.md
- **Sub-steps:** Unique tracking link, 5-minute interval storage, TTL options, auto-expiry, rate limiting
- **Requirements:** 12.12, 31.1–31.10

### 2. From requirements.md
- **Req 12.12:** Location sharing sessions with TTL between travelers and guides
- **Req 31.1:** Generate unique tracking link on enable
- **Req 31.2:** Store updates with 5-minute intervals
- **Req 31.3:** TTL options: 24 hours, 3 days, trip duration
- **Req 31.4:** Tracking link returns latest GPS coordinates
- **Req 31.5:** Store location history for active sessions
- **Req 31.6:** Delete location data on expiry
- **Req 31.7:** Rate limit: 1 location update per minute per user
- **Req 31.8:** Validate GPS coordinate format and accuracy
- **Req 31.9:** Return tracking status (active, expired, cancelled)
- **Req 31.10:** Allow user to cancel session early

### 3. From design.md
- **Redis key:** `session:{sessionId}` TTL: up to 7 days

### 4. Implementation Summary
- Session stored in Redis with location history array; UUID tracking link generated with `crypto.randomUUID()`
- Rate limit via Redis counter `rate_limit:location:{userId}:{minute}`
- Cancel: `redis.del('session:{sessionId}')`

### 5. Verification
- [ ] >1 location update per minute returns 429
- [ ] Session auto-expires and data deleted after TTL

---

## Task: 15.4 — Write Property Tests: Emergency Alerts (Properties 47–53)

### 1. From tasks.md
- **Sub-steps:** Properties 47–53
- **Requirements:** 12.1–12.12

### 2. From requirements.md
- **Property 47:** Alert record contains provided latitude, longitude, accuracy
- **Property 48:** New alert status = SENT
- **Property 49:** Push + SMS notifications sent to support on alert creation
- **Property 50:** Response includes support contacts, police number, nearest hospital
- **Property 51:** Alert records never deleted; only status updates allowed
- **Property 52:** GPS coordinates within Cambodia → province-specific contacts returned
- **Property 53:** Location sharing session auto-expires and data deleted after TTL

### 3. From design.md
- **Pattern:**
  ```typescript
  const cambodiaCoordinates = fc.record({
    latitude: fc.float({ min: 10.0, max: 14.7 }),
    longitude: fc.float({ min: 102.3, max: 107.7 })
  });
  ```

### 4. Implementation Summary
- 7 property tests in `src/emergency/emergency.service.spec.ts`

### 5. Verification
- [ ] All 7 property tests pass with 100 runs

---

## Task: 16.1 — Implement Student Discount Service

### 1. From tasks.md
- **Sub-steps:** `startVerification()`, admin `reviewVerification()`, update user on approval; 10 MB limit
- **Requirements:** 13.1–13.10

### 2. From requirements.md
- **Req 13.1–13.3:** Accept student_id_image + face_selfie uploads; store in Supabase Storage
- **Req 13.4:** Create verification record with status PENDING
- **Req 13.5:** Admin updates status to APPROVED or REJECTED
- **Req 13.6–13.7:** On approval: set `is_student = true`, `student_verified_at = now()`
- **Req 13.8:** Set `expires_at = now() + 1 year`
- **Req 13.9:** Apply student discount on bookings
- **Req 13.10:** Maximum 10 MB for student ID uploads

### 3. From design.md
- **Files:** `src/student-discount/student-discount.service.ts`, `student-discount.controller.ts`

### 4. Implementation Summary
- File size validation pre-upload; 413 response if > 10 MB
- On approval: Prisma transaction updates `StudentVerification` + `User` atomically
- Student discount applied in `BookingService.applyDiscounts()` when `user.isStudent === true`

### 5. Verification
- [ ] Upload > 10 MB returns 413
- [ ] Approved verification sets `user.isStudent = true` and `student_verified_at`

---

## Task: 17.1 — Implement Loyalty Service

### 1. From tasks.md
- **Sub-steps:** `awardPoints()`, `redeemPoints()`, `reversePoints()`, `getBalance()`, `getTransactionHistory()`
- **Requirements:** 14.1–14.10

### 2. From requirements.md
- **Req 14.1:** Award 2 points per USD spent on confirmed booking
- **Req 14.2–14.3:** Add points to user balance; create EARNED transaction record
- **Req 14.4:** Redemption rate: 100 points = 1 USD
- **Req 14.5–14.7:** Verify sufficient balance; deduct; create REDEEMED record
- **Req 14.8–14.9:** Reverse on refund; create ADJUSTED record
- **Req 14.10:** Return balance and transaction history

### 3. From design.md
- **Interface:**
  ```typescript
  interface LoyaltyService {
    awardPoints(userId: string, amount: number, bookingId: string): Promise<void>;
    redeemPoints(userId: string, amount: number, bookingId: string): Promise<void>;
    reversePoints(userId: string, bookingId: string): Promise<void>;
    getBalance(userId: string): Promise<number>;
    calculateEarnedPoints(amountUsd: number): number; // amountUsd * 2
    calculateRedemptionValue(points: number): number;  // points / 100
  }
  ```

### 4. Implementation Summary
- All point mutations in DB transactions updating both `User.loyaltyPoints` and creating `LoyaltyTransaction`
- `redeemPoints()` throws `INSUFFICIENT_POINTS` error with current balance if `user.loyaltyPoints < amount`

### 5. Verification
- [ ] 2 points awarded per $1 of booking value
- [ ] 100 points redeemed = $1 discount applied
- [ ] Insufficient points → 400 error with current balance

---

## Task: 17.3 — Write Property Test: Loyalty Redemption (Property 58)

### 1. From tasks.md
- **Sub-steps:** Property 58
- **Requirements:** 34.6

### 2. From requirements.md
- **Property 58:** Attempt to redeem more points than balance → error with current balance included

### 3. From design.md
- **Pattern:** Generate arbitrary `redeemAmount > userBalance`; assert error contains balance

### 4. Implementation Summary
- Property test in `src/loyalty/loyalty.service.spec.ts`

### 5. Verification
- [ ] Property 58 passes 100 runs

---

## Task: 18.1 — Implement Notification Service

### 1. From tasks.md
- **Sub-steps:** All notification methods; Resend email; FCM push; SMS; multi-language; retry logic; fallback; delivery status
- **Requirements:** 15.1–15.10, 39.1–39.10

### 2. From requirements.md
- **Req 15.1:** Email confirmation on booking confirmed (via Resend)
- **Req 15.2:** Push notification on booking confirmed (via FCM)
- **Req 15.3:** Reminder 24 hours before travel
- **Req 15.4–15.7:** Notifications for payment failure, cancellation, refund, emergency acknowledgment
- **Req 15.8:** Festival alerts
- **Req 15.9:** Store notification records with delivery status
- **Req 15.10:** Templates in EN, KH, ZH
- **Req 39.1:** Retry 3 times with exponential backoff on failure
- **Req 39.2:** Fallback from push to email
- **Req 39.3:** Log email delivery failures; alert support
- **Req 39.4:** Track status: sent, delivered, failed, opened
- **Req 39.7:** Respect user notification preferences

### 3. From design.md
- **Files:** `src/notifications/notifications.service.ts`, `src/notifications/templates/`
- **Interface:**
  ```typescript
  interface NotificationService {
    sendBookingConfirmation(booking: Booking): Promise<void>;
    sendEmail(to: string, template: string, data: any, language: Language): Promise<void>;
    sendPushNotification(userId: string, title: string, body: string): Promise<void>;
    retryFailedNotification(notificationId: string): Promise<void>;
  }
  ```
- **Retry pattern:**
  ```typescript
  async function withRetry<T>(op: () => Promise<T>, maxRetries = 3, backoffMs = 1000): Promise<T>
  ```

### 4. Implementation Summary
- Email via Resend SDK; push via Firebase Admin SDK
- Templates use variable substitution based on `language` param
- Notification row created before send; status updated on success/failure
- Retry logic wraps external calls; after 3 failures, fallback from push to email

### 5. Verification
- [ ] Booking confirmation email sent after payment webhook
- [ ] Failed push notification falls back to email
- [ ] Retry attempted 3 times before marking as failed

---

## Task: 18.2 — Create Notification Templates

### 1. From tasks.md
- **Sub-steps:** booking-confirmation, payment-failed, travel-reminder, refund-confirmation templates in 3 languages
- **Requirements:** 15.10, 39.8

### 2. From requirements.md
- **Req 15.10:** Support EN, KH, ZH templates
- **Req 39.8:** Templates with variable substitution

### 3. From design.md
- **Files:** `src/notifications/templates/booking-confirmation.template.ts`, `payment-failed.template.ts`

### 4. Implementation Summary
- Templates as TypeScript objects keyed by `Language` enum
- `renderTemplate(name, data, language)` replaces `{{variable}}` placeholders

### 5. Verification
- [ ] `renderTemplate('booking-confirmation', { bookingRef: 'DLG-2025-0001' }, 'KH')` returns Khmer content

---

## Task: 19.1 — Implement Explore Service

### 1. From tasks.md
- **Sub-steps:** `getPlaces()`, category/province/text-search filters, multi-language, offline flag
- **Requirements:** 16.1–16.9

### 2. From requirements.md
- **Req 16.1–16.2:** Filter by province and category
- **Req 16.3:** Content in requested language
- **Req 16.4:** Include GPS coordinates
- **Req 16.5–16.6:** Include tips, dress code, entry fees, opening hours
- **Req 16.7:** Text search across names and descriptions
- **Req 16.8:** Mark `offline_available` places
- **Req 16.9:** Include multiple image URLs

### 3. From design.md
- **Files:** `src/explore/explore.service.ts`, `src/explore/explore.controller.ts`

### 4. Implementation Summary
- Prisma full-text search via `search` filter on `name_en`, `description_en` (and localized fields)
- `offline_available` field returned as boolean in response

### 5. Verification
- [ ] Text search returns places matching query in name or description
- [ ] Place response includes GPS coordinates and image URLs

---

## Task: 20.1 — Implement Festivals Service

### 1. From tasks.md
- **Sub-steps:** `getFestivals()`, `getUpcomingFestivals()`; discount code generation; active filter
- **Requirements:** 17.1–17.7

### 2. From requirements.md
- **Req 17.1:** Date range filter
- **Req 17.2:** Upcoming festivals ordered by start_date
- **Req 17.3:** Multi-language content
- **Req 17.4:** Link festivals to places
- **Req 17.5–17.6:** Auto-generate discount codes; return with validity period
- **Req 17.7:** Only active festivals

### 3. From design.md
- **Files:** `src/festivals/festivals.service.ts`, `src/festivals/festivals.controller.ts`

### 4. Implementation Summary
- Discount code auto-generated as `FEST-{festivalId}-{year}` on festival creation/activation
- Upcoming: `where: { isActive: true, startDate: { gte: new Date() } }` ordered by `startDate`

### 5. Verification
- [ ] Inactive festivals excluded from results
- [ ] Festival response includes discount code with expiry

---

## Task: 21.1 — Implement Currency Service

### 1. From tasks.md
- **Sub-steps:** `fetchExchangeRates()`; USD/KHR/CNY; Redis cache 1 hour; fallback defaults
- **Requirements:** 18.1–18.5

### 2. From requirements.md
- **Req 18.1:** Fetch from ExchangeRate-API
- **Req 18.2:** Cache in Redis with 1-hour TTL
- **Req 18.3:** Support USD, KHR, CNY
- **Req 18.4:** Return current rates for all currencies
- **Req 18.5:** Refresh on cache expiry

### 3. From design.md
- **Redis key:** `currency:rates` TTL: 3600 s
- **Fallback:** `{ USD: 1.0, KHR: 4100.0, CNY: 7.25 }`

### 4. Implementation Summary
  ```typescript
  async getCurrencyRates(): Promise<ExchangeRates> {
    const cached = await this.redis.get('currency:rates');
    if (cached) return JSON.parse(cached);
    const rates = await this.fetchExchangeRates(); // ExchangeRate-API call
    await this.redis.setex('currency:rates', 3600, JSON.stringify(rates));
    return rates;
  }
  ```

### 5. Verification
- [ ] Second call within 1 hour returns cached rates (no API call)
- [ ] API failure returns default rates without error to client

---

## Task: 22 — Checkpoint — Ensure All Tests Pass

### Verification
- [ ] `npm test` passes all tests
- [ ] No TypeScript errors

---

## Task: 23.1 — Implement AI Tools Service

### 1. From tasks.md
- **Sub-steps:** `suggestTrips()`, `createBookingForAI()`, `cancelBookingForAI()`, `generateQRPaymentForAI()`, `getBookingStatus()`, `searchPlaces()`; standardized error codes
- **Requirements:** 19.1, 19.4–19.10

### 2. From requirements.md
- **Req 19.1:** Endpoints under `/v1/ai-tools/` prefix
- **Req 19.4:** Trip suggestion tool querying by preferences
- **Req 19.5:** Booking creation with validation
- **Req 19.6:** Booking cancellation
- **Req 19.7:** QR payment generation
- **Req 19.8:** Booking status check by ref
- **Req 19.9:** Place search
- **Req 19.10:** Standardized error codes for AI parsing

### 3. From design.md
- **Files:** `src/ai-tools/ai-tools.service.ts`, `src/ai-tools/ai-tools.controller.ts`
- **Pattern:** Delegate to existing services; wrap with AI-friendly error codes

### 4. Implementation Summary
- `suggestTrips()` calls `tripsService.getTrips()` with preference mapping
- All methods return `{ success, data, errorCode }` envelope for machine parsing

### 5. Verification
- [ ] AI tools return machine-readable `errorCode` on failure
- [ ] Booking creation via AI tool follows same validation as regular booking endpoint

---

## Task: 23.2 — Create AI Tools Controller

### 1. From tasks.md
- **Sub-steps:** All 6 AI tool endpoints; `ServiceKeyGuard`; validate `X-Service-Key`
- **Requirements:** 19.1–19.3

### 2. From requirements.md
- **Req 19.2:** Protect with Service Key authentication guard
- **Req 19.3:** Validate `X-Service-Key` header

### 3. From design.md
- **Interface:**
  ```
  POST /v1/ai-tools/suggest-trips          @UseGuards(ServiceKeyGuard)
  POST /v1/ai-tools/create-booking         @UseGuards(ServiceKeyGuard)
  POST /v1/ai-tools/cancel-booking         @UseGuards(ServiceKeyGuard)
  POST /v1/ai-tools/generate-qr-payment    @UseGuards(ServiceKeyGuard)
  GET  /v1/ai-tools/booking-status/:ref    @UseGuards(ServiceKeyGuard)
  POST /v1/ai-tools/search-places          @UseGuards(ServiceKeyGuard)
  ```

### 4. Implementation Summary
- `ServiceKeyGuard` applied at controller level via `@UseGuards(ServiceKeyGuard)`

### 5. Verification
- [ ] Request without `X-Service-Key` returns 401
- [ ] Request with wrong key returns 401

---

## Task: 24.1 — Implement Redis Service

### 1. From tasks.md
- **Sub-steps:** `get`, `set`, `setex`, `del`, `incr`, `expire`, `publish`, `subscribe`
- **Requirements:** 20.1, 20.9

### 2. From requirements.md
- **Req 20.1:** Connect to Upstash Redis using REDIS_URL
- **Req 20.9:** Redis service with methods: get, set, del, setex, publish, subscribe

### 3. From design.md
- **Files:** `src/redis/redis.service.ts`
- **Interface:**
  ```typescript
  @Injectable()
  export class RedisService {
    async get(key: string): Promise<string | null>;
    async set(key: string, value: string): Promise<void>;
    async setex(key: string, seconds: number, value: string): Promise<void>;
    async del(key: string): Promise<void>;
    async incr(key: string): Promise<number>;
    async expire(key: string, seconds: number): Promise<void>;
    async publish(channel: string, message: string): Promise<void>;
    async subscribe(channel: string, callback: (message: string) => void): Promise<void>;
  }
  ```

### 4. Implementation Summary
- Wraps `ioredis` or Upstash `@upstash/redis`; `subscribe` duplicates client for pub/sub isolation

### 5. Verification
- [ ] `setex` key expires after specified seconds
- [ ] `subscribe` callback receives published messages

---

## Task: 24.2–24.4 — Implement Redis Key Patterns and Pub/Sub

### 1. From tasks.md
- **Requirements:** 20.2–20.8

### 2. From requirements.md
- **Req 20.2:** `booking_hold:{bookingId}` TTL 900 s
- **Req 20.3:** `session:{sessionId}` TTL 604800 s (7 days)
- **Req 20.4:** `currency:rates` TTL 3600 s
- **Req 20.5:** `weather:{city}` TTL 3600 s
- **Req 20.6:** `refresh_token_version:{userId}` permanent
- **Req 20.7:** `rate_limit:{endpoint}:{userId}:{window}` TTL = window
- **Req 20.8:** Publish to `payment_events:{userId}` on payment success

### 3. From design.md
- **All Redis key patterns documented in Redis Integration section**

### 4. Implementation Summary
- Constants file `src/redis/redis-keys.ts` with key-builder functions
- Rate limiter increments counter; sets expiry on first call

### 5. Verification
- [ ] All key patterns follow documented naming convention
- [ ] Rate limit counter resets after window expires

---

## Task: 25.1–25.2 — Implement Background Jobs

### 1. From tasks.md
- **Requirements:** 21.1–21.6

### 2. From requirements.md
- **Req 21.1:** Booking cleanup cron every 5 minutes
- **Req 21.2:** Cancel RESERVED bookings where `reserved_until` is past; delete Redis key
- **Req 21.3:** Travel reminder cron daily at 9 AM Cambodia time
- **Req 21.4:** Send notifications for bookings starting tomorrow
- **Req 21.5–21.6:** Festival alert cron daily at 8 AM; notify about festivals starting in 1–3 days

### 3. From design.md
- **Files:** `src/jobs/jobs.service.ts`, `src/jobs/jobs.module.ts`
- **Interface:**
  ```typescript
  @Cron('*/5 * * * *')
  async cleanupExpiredBookings() { ... }

  @Cron('0 9 * * *', { timeZone: 'Asia/Phnom_Penh' })
  async sendTravelReminders() { ... }

  @Cron('0 8 * * *', { timeZone: 'Asia/Phnom_Penh' })
  async sendFestivalAlerts() { ... }
  ```

### 4. Implementation Summary
- `@nestjs/schedule` module; batch-process expired bookings to avoid timeout
- Travel reminder queries bookings where `travelDate BETWEEN tomorrow 00:00 AND tomorrow 23:59`

### 5. Verification
- [ ] Expired RESERVED bookings changed to CANCELLED within 5 minutes
- [ ] Travel reminders sent exactly 24 hours before travel date

---

## Task: 26.1 — Implement AI Budget Planner

### 1. From tasks.md
- **Requirements:** 27.1–27.10

### 2. From requirements.md
- **Req 27.1–27.2:** Calculate MIN/MAX cost by duration, group size, accommodation tier, transport type
- **Req 27.3:** Breakdown: accommodation, transport, guide, meals, entry fees, extras
- **Req 27.4–27.5:** Currency conversion (USD/KHR/CNY); hourly cache refresh
- **Req 27.7–27.9:** Province-specific adjustments; Angkor pass fees; meals 15–20 USD/person/day
- **Req 27.10:** Accessible via AI tools endpoint

### 3. From design.md
- **Files:** `src/ai-tools/ai-tools.service.ts` (budget planner method)

### 4. Implementation Summary
- `calculateBudgetEstimate()` applies province multipliers, tier price lookups, Angkor pass schedule
- Angkor pass: 1 day $37, 3 days $62, 7 days $72 (built-in constants)

### 5. Verification
- [ ] Budget estimate for Siem Reap includes Angkor pass fee
- [ ] Response includes MIN and MAX values

---

## Task: 26.2 — Implement Offline Map Data

### 1. From tasks.md
- **Requirements:** 28.1–28.10

### 2. From requirements.md
- GeoJSON format; province-scoped; place categories; emergency locations; gzip; 7-day Redis cache; version with `last_updated`

### 3. From design.md
- Redis key: `map:{province}` TTL 604800 s

### 4. Implementation Summary
- Returns `FeatureCollection` GeoJSON with `properties.category` and `properties.derlgBookable`
- gzip applied via NestJS compression middleware; size returned in response header

### 5. Verification
- [ ] Map data response is valid GeoJSON `FeatureCollection`
- [ ] Response includes `last_updated` timestamp

---

## Task: 26.3 — Implement Booking Itinerary Management

### 1. From tasks.md
- **Requirements:** 30.1–30.10

### 2. From requirements.md
- Day-by-day itinerary; driver contacts 24 h before; shareable link; iCal export; weather forecast; multi-language

### 3. From design.md
- Public endpoint: `GET /v1/itinerary/{booking_ref}` (no auth)
- Link format: `derlg.com/trip/{booking_ref}`

### 4. Implementation Summary
- iCal generated via `ical-generator` npm package
- Weather forecast fetched from OpenWeather API; cached in Redis `weather:{province}`
- Public itinerary endpoint reads booking and masks sensitive payment data

### 5. Verification
- [ ] Shareable link accessible without authentication
- [ ] iCal export contains all travel events

---

## Task: 26.4 — Implement Review and Rating System

### 1. From tasks.md
- **Requirements:** 32.1–32.10

### 2. From requirements.md
- Completed booking required; 1–5 stars; max 1000 char text; max 5 photos; 50 loyalty points on review; average rating calculation; prevent duplicates; 7-day edit window

### 3. From design.md
- Model: `Review` linked to `Booking`, `User`, and entity (Trip/Hotel/Guide/Vehicle)

### 4. Implementation Summary
- `submitReview()` verifies `booking.status === 'COMPLETED'` and `booking.userId === userId`
- Average rating via `prisma.review.aggregate({ _avg: { rating: true } })`
- 7-day edit window enforced: `review.createdAt + 7d > now()`

### 5. Verification
- [ ] Review submission for non-completed booking returns 400
- [ ] Duplicate review for same booking returns 409
- [ ] 50 loyalty points awarded on review submission

---

## Task: 26.5 — Implement Referral Program

### 1. From tasks.md
- **Requirements:** 33.1–33.10

### 2. From requirements.md
- Referral code format `DERLG-{prefix}{digit}`; link referrer on signup; 500 points to both on referee's first booking; prevent self-referral; track status

### 3. From design.md
- Referral code stored on `User` model; `referredBy` FK to referrer

### 4. Implementation Summary
- Code generated at registration: `DERLG-${username.slice(0,3).toUpperCase()}${Math.floor(Math.random()*10)}`
- Self-referral check: compare email + device fingerprint (from `User-Agent` + IP hash)

### 5. Verification
- [ ] Referral code matches format `DERLG-[A-Z]{3}[0-9]`
- [ ] Self-referral attempt returns 400

---

## Task: 27.1–27.4 — Advanced Error Handling and Validation

### 1. From tasks.md
- **Requirements:** 34.1–34.15

### 2. From requirements.md
- **Req 34.1:** Retry DB connections 3 times with exponential backoff
- **Req 34.2:** 503 + retry-after when Stripe unavailable
- **Req 34.3:** `BOOKING_EXPIRED` when hold expires during payment
- **Req 34.4:** DB transactions with row locking for concurrent bookings
- **Req 34.6:** Error with current balance when loyalty points insufficient
- **Req 34.7:** Reject emergency alert with GPS outside Cambodia bounds
- **Req 34.8:** 413 before processing if upload exceeds size limit
- **Req 34.10:** 401 with `TOKEN_EXPIRED` for expired JWT
- **Req 34.11:** Token version mismatch → require re-login
- **Req 34.12:** Cancel after travel date → `TRIP_ALREADY_STARTED`
- **Req 34.14:** Invalid discount code → error with expiry date
- **Req 34.15:** Availability conflict → return conflicting booking dates

### 3. From design.md
- **Retry utility:**
  ```typescript
  async function withRetry<T>(op: () => Promise<T>, maxRetries = 3, backoffMs = 1000): Promise<T>
  ```
- **Error codes table:** TOKEN_EXPIRED → 401, BOOKING_EXPIRED → 400, RESOURCE_UNAVAILABLE → 409, etc.

### 4. Implementation Summary
- `withRetry` wraps Stripe and external API calls with exponential backoff (`backoffMs * 2^attempt`)
- GPS validation: reject if `lat < 10.0 || lat > 14.7 || lng < 102.3 || lng > 107.7`
- File size validation via `multer` limits before upload processing

### 5. Verification
- [ ] Property 61: Token version mismatch → 401 re-login required
- [ ] Property 62: Post-travel cancel → 400 `TRIP_ALREADY_STARTED`
- [ ] Property 63: Expired discount code → error includes expiry date
- [ ] Property 64: Unavailable resource → response includes conflicting dates

---

## Task: 28.1–28.3 — Availability and Date Validation (Properties 65–69)

### 1. From tasks.md
- **Requirements:** 38.1–38.10

### 2. From requirements.md
- **Req 38.1–38.6:** Query all bookings; transactions; overlap detection; hold consideration; pessimistic locking; sequential processing
- **Req 38.7:** Travel dates must be in the future
- **Req 38.8:** Check-out after check-in
- **Req 38.9:** No bookings more than 2 years ahead
- **Req 38.10:** Return alternative dates on unavailability

### 3. From design.md
- **Availability query:**
  ```typescript
  where: {
    [resourceType]: resourceId,
    OR: [{ status: 'CONFIRMED' }, { status: 'RESERVED', reservedUntil: { gt: new Date() } }],
    AND: [{ travelDate: { lte: endDate } }, { endDate: { gte: startDate } }]
  }
  ```

### 4. Implementation Summary
- Date validations in `CreateBookingDto` using `@IsDateString()` + custom validators
- Alternative dates: query next 3 available 3-day windows around requested date

### 5. Verification
- [ ] Property 65: Overlapping confirmed booking → availability = false
- [ ] Property 66: Past travel date → 400 validation error
- [ ] Property 67: Check-out ≤ check-in → 400 validation error
- [ ] Property 68: Travel date > 2 years → 400 validation error
- [ ] Property 69: Unavailable response includes alternative dates array

---

## Task: 29.1–29.3 — Discount Code System (Properties 70–80)

### 1. From tasks.md
- **Requirements:** 40.1–40.15

### 2. From requirements.md
- **Req 40.1–40.4:** Validate: exists, active, date range, usage limit, booking type
- **Req 40.5:** No stacking of multiple discount codes
- **Req 40.6–40.7:** Stack with loyalty points and student discount
- **Req 40.8:** Specific error reason for invalid codes
- **Req 40.9:** Track usage count per user
- **Req 40.10:** PERCENTAGE or FIXED_AMOUNT calculation
- **Req 40.11:** Enforce minimum booking amount
- **Req 40.13:** Prevent same code applied twice to same booking
- **Req 40.14–40.15:** Return `discount_usd` in summary; store `discountCodeId` in booking

### 3. From design.md
- **Discount code arbitrary:**
  ```typescript
  const discountCode = fc.record({
    code: fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), { minLength: 6, maxLength: 12 }),
    type: fc.constantFrom('PERCENTAGE', 'FIXED_AMOUNT'),
    value: fc.float({ min: 5, max: 100 }),
    isActive: fc.constant(true),
    validFrom: fc.date({ max: new Date() }),
    validUntil: fc.date({ min: new Date() }),
    usageLimit: fc.integer({ min: 10, max: 1000 }),
    usageCount: fc.integer({ min: 0, max: 9 })
  });
  ```

### 4. Implementation Summary
- `validateDiscountCode()` runs all checks sequentially; first failure returns specific error reason
- `calculateDiscountAmount()`: PERCENTAGE → `subtotal * value / 100`; FIXED_AMOUNT → `value`
- `usageCount` incremented atomically in same booking creation transaction

### 5. Verification
- [ ] Property 70: All 5 validation rules enforced
- [ ] Property 76: PERCENTAGE and FIXED_AMOUNT calculations accurate
- [ ] Property 80: `discount_code_id` stored in booking record

---

## Task: 30.1–30.4 — Security and Compliance (Property 81)

### 1. From tasks.md
- **Requirements:** 36.1–36.15

### 2. From requirements.md
- **Req 36.1–36.2:** AES-256 at rest; bcrypt passwords (12 salt rounds)
- **Req 36.3:** Mask credit card numbers in logs
- **Req 36.6:** Audit log for data access and modifications
- **Req 36.11:** Never log full credit card numbers
- **Req 36.12–36.14:** Session timeout 15 min; secure random tokens; CSRF protection
- **Property 81:** Non-whitelisted CORS origin → request rejected or no CORS headers

### 3. From design.md
- **CORS whitelist:** `['https://derlg.com', 'https://www.derlg.com']`
- **AuditInterceptor:** masks `password`, `cardNumber`, `cvv`, `ssn`

### 4. Implementation Summary
- bcrypt with `saltRounds: 12` for password hashing
- CSRF: `csurf` middleware for non-GET state-changing routes (or rely on SameSite cookie)
- Session timeout: JWT access token TTL = 15 min effectively enforces this

### 5. Verification
- [ ] Property 81: Request from `http://evil.com` gets no CORS headers
- [ ] `password` field never appears in logs
- [ ] Passwords stored as bcrypt hashes

---

## Task: 31 — Checkpoint — Ensure All Tests Pass

### Verification
- [ ] `npm test` passes all tests
- [ ] `npm run test:property` all 81 properties pass

---

## Task: 32.1–32.4 — Performance and Scalability

### 1. From tasks.md
- **Requirements:** 35.1–35.15

### 2. From requirements.md
- **Req 35.1:** Health check < 100 ms
- **Req 35.2:** Redis caching with appropriate TTL
- **Req 35.3:** Connection pooling min 10, max 100
- **Req 35.4:** Pagination default 20 items/page
- **Req 35.5:** Indexes on all FK and queried columns
- **Req 35.6:** gzip for responses > 1 KB
- **Req 35.10:** Request timeout 30 seconds
- **Req 35.14:** Stateless architecture for horizontal scaling
- **Req 35.15:** Redis for distributed rate limiting

### 3. From design.md
- **Connection pool:**
  ```prisma
  datasource db { connection_limit = 100 }
  ```
- **Caching:** trip data cached 1 hour; map data 7 days

### 4. Implementation Summary
- `compression()` middleware applied globally
- Prisma `select` used strategically to avoid over-fetching
- `helmet()` for security headers
- All rate limiters use Redis counters (stateless across instances)

### 5. Verification
- [ ] `/health` responds < 100 ms under normal load
- [ ] `Content-Encoding: gzip` present on large responses

---

## Task: 33.1 — Webhook Reliability

### 1. From tasks.md
- **Requirements:** 37.1–37.10

### 2. From requirements.md
- Signature verify → 500 on failure → dead letter queue after 5 retries → respond within 5 s

### 3. From design.md
- Webhook processing sequence diagram with idempotency check

### 4. Implementation Summary
- Background queue (e.g., Bull/BullMQ) for async webhook processing
- Dead letter queue stores failed webhooks; support team alerted after 5 retries

### 5. Verification
- [ ] Webhook without valid signature returns 400
- [ ] Webhook processed idempotently (duplicate returns 200)
- [ ] Response to Stripe within 5 seconds

---

## Task: 34.1–34.2 — Notification Delivery Reliability

### 1. From tasks.md
- **Requirements:** 39.1–39.10

### 2. From requirements.md
- Retry 3 times; push → email fallback; log failures; priority queue; unsubscribe functionality

### 3. From design.md
- `withRetry()` wraps notification sends; `Notification.status` tracked

### 4. Implementation Summary
- Priority queue levels: CRITICAL (emergency), HIGH (booking/payment), NORMAL (reminders/festivals)
- Unsubscribe token appended to marketing email footer

### 5. Verification
- [ ] Failed push notification falls back to email after 3 retries
- [ ] Unsubscribe link disables marketing notifications

---

## Task: 35.1–35.6 — Docker Development Environment

### 1. From tasks.md
- **Requirements:** 41.1–41.15, 42.1–42.10, 43.1–43.15, 44.1–44.10, 47.1–47.10, 48.1–48.10, 49.1–49.10, 50.1–50.10, 51.1–51.10, 52.1–52.10, 53.1–53.15

### 2. From requirements.md
- **Req 41.1:** `docker-compose.yml` orchestrating all development services
- **Req 41.2:** Multi-stage Dockerfile for NestJS
- **Req 43.1–43.5:** PostgreSQL 15 alpine; env vars; port 5432; volume; health check
- **Req 43.6–43.10:** Redis 7 alpine; port 6379; volume; health check; appendonly
- **Req 43.11–43.15:** Backend: Node 20 alpine; dev env; wait for deps; non-root user; /app workdir
- **Req 44.1–44.10:** All services on `derlg-network`; DNS by service name
- **Req 47.1–47.10:** Multi-stage build; layer caching; alpine; .dockerignore
- **Req 51.1–51.10:** Health checks every 10 s; restart `unless-stopped`; 3 failures = unhealthy

### 3. From design.md
- **Health check endpoint:** `/health` returns `{ status: 'healthy', services: { database: 'up', redis: 'up' } }`

### 4. Implementation Summary (docker-compose.yml structure):
  ```yaml
  version: '3.9'
  services:
    postgres:
      image: postgres:15-alpine
      environment: { POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB: derlg_dev }
      ports: ["5432:5432"]
      volumes: [postgres_data:/var/lib/postgresql/data]
      healthcheck: { test: ["CMD", "pg_isready"], interval: 10s, timeout: 5s, retries: 3, start_period: 30s }
    redis:
      image: redis:7-alpine
      command: redis-server --appendonly yes
      ports: ["6379:6379"]
      volumes: [redis_data:/data]
      healthcheck: { test: ["CMD", "redis-cli", "ping"], interval: 10s, timeout: 5s, retries: 3, start_period: 30s }
    backend:
      build: { context: ., dockerfile: Dockerfile, target: development }
      ports: ["3001:3001", "9229:9229"]
      volumes: [.:/app, node_modules:/app/node_modules]
      depends_on: { postgres: { condition: service_healthy }, redis: { condition: service_healthy } }
      env_file: .env
      restart: unless-stopped
  networks:
    default: { name: derlg-network }
  volumes:
    postgres_data: redis_data: node_modules:
  ```

### 5. Verification
- [ ] `docker-compose up` starts all services without errors
- [ ] Backend waits for PostgreSQL and Redis health checks before starting
- [ ] Source code changes trigger hot reload without rebuild

---

## Task: 36.1–36.5 — Docker Environment and Database Setup

### 1. From tasks.md
- **Requirements:** 45.1–45.10, 46.1–46.10, 50.1–50.10, 51.3–51.10, 52.1–52.10

### 2. From requirements.md
- **Req 45.1:** `.env.example` with all required variables
- **Req 45.3–45.4:** `DATABASE_URL=postgresql://user:password@postgres:5432/derlg_dev`; `REDIS_URL=redis://redis:6379`
- **Req 46.1–46.2:** Auto-run migrations and seeds on first startup
- **Req 46.4:** Seed creates sample users, trips, hotels, guides
- **Req 50.1–50.7:** json-file logging driver; 10 MB limit; 3 file rotation
- **Req 52.1–52.9:** Named volumes; bind mounts for source; named volume for node_modules

### 3. From design.md
- **Environment variables:** DATABASE_URL, DIRECT_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, AI_SERVICE_KEY, REDIS_URL, RESEND_API_KEY, SENTRY_DSN

### 4. Implementation Summary
- `docker-entrypoint.sh` runs `npx prisma migrate deploy && npm run seed` before starting app
- `.env.example` documents all variables with placeholder values and descriptions
- Logging: `{ "driver": "json-file", "options": { "max-size": "10m", "max-file": "3" } }` in compose

### 5. Verification
- [ ] `docker-compose up` triggers migration and seed automatically
- [ ] `.env.example` documents all required environment variables
- [ ] Missing required env var produces clear startup error

---

## Task: 37.1–37.2 — Docker Multi-Service Integration and Production Config

### 1. From tasks.md
- **Requirements:** 44.4–44.5, 44.8–44.9, 48.1–48.10, 53.1–53.15

### 2. From requirements.md
- **Req 53.5:** Frontend `NEXT_PUBLIC_API_URL=http://backend:3001`
- **Req 53.9:** Chatbot `BACKEND_API_URL=http://backend:3001`
- **Req 48.1:** Separate `docker-compose.prod.yml`
- **Req 48.3–48.5:** Production: managed Supabase + Upstash Redis; optimized builds; no dev dependencies

### 3. From design.md
- Production uses external managed services; no local DB or Redis containers

### 4. Implementation Summary
- `docker-compose.prod.yml` removes `postgres` and `redis` services; sets `NODE_ENV=production`; uses `target: production` build stage
- Frontend and chatbot services defined with source code mounts for dev hot reload

### 5. Verification
- [ ] `docker-compose -f docker-compose.prod.yml up` starts backend without local DB
- [ ] Frontend container accessible at `http://localhost:3000`
- [ ] Chatbot container connects to backend using `http://backend:3001`

---

## Task: 38.1–38.3 — API Documentation and Testing Setup

### 1. From tasks.md
- **Requirements:** 24.1–24.5, 42.7

### 2. From requirements.md
- **Req 24.1:** Swagger at `/api-docs`
- **Req 24.2:** Request/response examples
- **Req 24.3:** Document authentication requirements
- **Req 24.4:** E2E tests for auth, booking, payment flows
- **Req 24.5:** Unit tests for service layer

### 3. From design.md
- **Testing tools:** Jest, fast-check, Supertest, @nestjs/testing, Prisma Client Mock
- **CI:** GitHub Actions; postgres + redis services; `npm run test:cov` → `test:property` → `test:e2e`

### 4. Implementation Summary
- Swagger setup via `@nestjs/swagger`; `@ApiOperation`, `@ApiResponse` decorators on all endpoints
- Jest config: `collectCoverageFrom: ['src/**/*.ts']`, `coverageThreshold: { global: { lines: 80 } }`
- VS Code `launch.json` for Docker container debugger on port 9229

### 5. Verification
- [ ] `GET /api-docs` returns Swagger UI
- [ ] Code coverage ≥ 80% (`npm run test:cov`)
- [ ] All E2E tests pass

---

## Task: 39.1–39.2 — Deployment Configuration

### 1. From tasks.md
- **Requirements:** 25.1–25.8

### 2. From requirements.md
- **Req 25.1:** Port 3001
- **Req 25.2:** Compression middleware
- **Req 25.3:** Winston logger
- **Req 25.4:** Sentry integration
- **Req 25.5:** `/health` endpoint
- **Req 25.6:** Log unhandled exceptions with stack traces
- **Req 25.7:** Connection pooling
- **Req 25.8:** Graceful shutdown on SIGTERM

### 3. From design.md
- **Graceful shutdown:**
  ```typescript
  app.enableShutdownHooks();
  process.on('SIGTERM', async () => { await app.close(); process.exit(0); });
  ```

### 4. Implementation Summary
- `main.ts` applies: `compression()`, `helmet()`, `enableCors()`, `useGlobalPipes`, `useGlobalFilters`, `useGlobalInterceptors`
- Production environment variables documented in `README.md` deployment section

### 5. Verification
- [ ] SIGTERM signal causes graceful shutdown (connections drained)
- [ ] Production app listens on port 3001

---

## Task: 40.1–40.3 — Final Integration and Testing

### 1. From tasks.md
- **Requirements:** 46.4, 24.4, 1.10, 19.1–19.2, 20.8, 29.1–29.10

### 2. From requirements.md
- Seed data with sample users, trips, hotels, guides, discount codes
- E2E tests for complete booking + payment flow
- Multi-language support verified across all endpoints
- CORS verified for frontend requests

### 3. From design.md
- **E2E test pattern:**
  ```typescript
  it('complete booking and payment flow', async () => {
    // 1. Register → 2. Create booking → 3. Create payment intent → 4. Simulate webhook → 5. Verify CONFIRMED
  });
  ```

### 4. Implementation Summary
- Seed file: `prisma/seed.ts` creates realistic sample data for all 18 models
- E2E test suite covers 6 critical flows: auth, booking, payment, refund, emergency, loyalty

### 5. Verification
- [ ] `npm run docker:seed` populates database with sample data
- [ ] All 6 E2E test flows pass end-to-end

---

## Task: 41 — Final Checkpoint — Ensure All Tests Pass

### Verification
- [ ] `npm test` — all unit tests pass
- [ ] `npm run test:property` — all 81 property-based tests pass (100 runs each)
- [ ] `npm run test:e2e` — all integration tests pass
- [ ] `npm run test:cov` — coverage ≥ 80%
- [ ] `docker-compose up` — full stack starts without errors
- [ ] `GET /health` — returns healthy status for all services
- [ ] All 81 correctness properties validated:
  - Properties 1–8: Authentication
  - Properties 9–12: User Management
  - Properties 13–21: Trip Catalog
  - Properties 22–30, 55, 57: Booking Management
  - Properties 31–40, 56: Payment Processing
  - Properties 41–46: Refund Processing
  - Properties 47–53: Emergency Alerts
  - Property 54: JSON Serialization
  - Properties 58–64: Error Handling
  - Properties 65–69: Availability and Dates
  - Properties 70–80: Discount Codes
  - Property 81: CORS

---

## Docker Commands Reference

```bash
npm run docker:up       # docker-compose up -d
npm run docker:down     # docker-compose down
npm run docker:logs     # docker-compose logs -f
npm run docker:build    # docker-compose build
npm run docker:reset    # docker-compose down -v && docker-compose up -d
npm run docker:migrate  # docker-compose exec backend npx prisma migrate deploy
npm run docker:seed     # docker-compose exec backend npm run seed
npm run docker:studio   # docker-compose exec backend npx prisma studio
npm run docker:shell    # docker-compose exec backend bash
npm run docker:psql     # docker-compose exec postgres psql -U user derlg_dev
npm run docker:redis-cli # docker-compose exec redis redis-cli
```

## Error Codes Quick Reference

| Code | HTTP | Description |
|------|------|-------------|
| TOKEN_EXPIRED | 401 | JWT access token expired |
| TOKEN_INVALID | 401 | JWT malformed or invalid |
| BOOKING_EXPIRED | 400 | Booking hold time expired |
| BOOKING_NOT_FOUND | 404 | Booking reference not found |
| INSUFFICIENT_POINTS | 400 | Not enough loyalty points |
| INVALID_DISCOUNT_CODE | 400 | Code invalid/expired/limit exceeded |
| RESOURCE_UNAVAILABLE | 409 | Resource already booked |
| PAYMENT_FAILED | 400 | Payment processing failed |
| TRIP_ALREADY_STARTED | 400 | Cannot cancel after travel date |
| INVALID_IMAGE_FORMAT | 400 | Image corrupted or wrong format |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |
| SERVICE_UNAVAILABLE | 503 | External service unavailable |
| DUPLICATE_RECORD | 409 | Unique constraint violation |
| VALIDATION_ERROR | 400 | Request data failed validation |
| UNAUTHORIZED | 401 | Authentication required |
| FORBIDDEN | 403 | Insufficient permissions |