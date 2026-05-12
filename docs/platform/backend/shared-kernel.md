# Shared Kernel (`common/`)

> **Phase 2** — Reusable primitives used by all feature modules. No business logic.

---

## Guards

Located in `src/common/guards/`. See [Security](./security.md) for auth guard behavior.

- `JwtAuthGuard`
- `RolesGuard`
- `ThrottlerGuard` (configuration, not repeated definitions)

---

## Decorators

Located in `src/common/decorators/`.

- `@CurrentUser()` — extracts user payload from request
- `@Roles(...roles: Role[])` — attaches required roles
- `@Public()` — opts route out of global auth

---

## Interceptors

Located in `src/common/interceptors/`.

| Interceptor | Responsibility |
|-------------|----------------|
| `LoggingInterceptor` | Request/response logging with timing (ms) and correlation ID |
| `TransformInterceptor` | Wraps all responses in the standard envelope (`{ success, data, message, error }`) |
| `CacheInterceptor` | Redis caching policy for read-heavy endpoints; TTL configurable per route |

**Caching rule of thumb:** Use Redis cache for expensive aggregations or rarely changing reference data. Prefer Prisma queries for user-specific or real-time data.

---

## Filters

Located in `src/common/filters/`.

| Filter | Mapping |
|--------|---------|
| `PrismaClientExceptionFilter` | `P2002` → 409 Conflict, `P2025` → 404 Not Found, others → 500 |
| `AllExceptionsFilter` | Unknown errors → 500 with a safe public message; full error logged internally |

---

## Utilities & Common DTOs

Located in `src/common/` or `src/common/dto/`.

- **Pagination DTO:** `limit`, `offset` (or `cursor` for cursor-based)
- **Sorting / filtering query parser:** Normalize query string arrays into Prisma `orderBy` / `where`
- **Date/time policy:** All dates stored and serialized as UTC; frontend handles localization

---

## Shared Interfaces

Located in `src/common/types/`.

### Response Envelope

All API responses (success and error) use this envelope:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string | null;
  error?: {
    code: string;
    details?: Record<string, any>;
  };
}
```

### Pagination

```typescript
interface PaginationDto {
  page: number;      // default: 1
  perPage: number;   // default: 20, max: 100
}

interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}
```

### Auth Service Contract

`AuthService` is part of the shared kernel because auth guards and the current-user decorator depend on its token shape.

```typescript
interface AuthService {
  register(dto: RegisterDto): Promise<AuthResponse>;
  login(dto: LoginDto): Promise<AuthResponse>;
  refreshAccessToken(refreshToken: string): Promise<AuthResponse>;
  logout(userId: string): Promise<void>;
  generateAccessToken(user: UserPayload): string;
  generateRefreshToken(user: UserPayload): string;
}

interface AuthResponse {
  success: boolean;
  data: {
    user: UserDto;
    accessToken: string;
    refreshToken: string;
  };
  message: string;
}

interface UserPayload {
  sub: string;       // user id
  role: UserRole;
  email: string;
  preferredLanguage: Language;
  tokenVersion: number;
}
```

### Redis Service Contract

```typescript
interface RedisService {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  setex(key: string, seconds: number, value: string): Promise<void>;
  del(key: string): Promise<void>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  publish(channel: string, message: string): Promise<void>;
  subscribe(channel: string, callback: (message: string) => void): Promise<void>;
}
```

---

## Checklist

- [ ] `LoggingInterceptor` with request timing
- [ ] `TransformInterceptor` wrapping all responses
- [ ] `PrismaClientExceptionFilter` handling known error codes
- [ ] `AllExceptionsFilter` as catch-all
- [ ] Pagination DTO reusable across modules
- [ ] UTC enforcement policy documented and applied
- [ ] `ApiResponse<T>` and `PaginatedResponse<T>` interfaces defined
