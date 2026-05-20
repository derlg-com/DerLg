---
inclusion: always
---

# Coding Conventions

## Error Handling

### Backend (NestJS)
- Throw NestJS built-in exceptions (`NotFoundException`, `BadRequestException`, etc.)
- Use custom exception filters for domain errors
- Always include meaningful error messages in the response envelope
- Log errors with structured context: `this.logger.error('Failed to create booking', { userId, tripId, error })`
- Wrap multi-table mutations in Prisma transactions with try/catch

```typescript
// ✅ Correct
throw new NotFoundException(`Trip ${id} not found`);

// ❌ Wrong
throw new Error('not found');
```

### Frontend (Next.js)
- Use React Error Boundaries for component-level failures
- Handle API errors in React Query's `error` callback
- Show user-friendly toast messages, never raw error strings
- Log errors to Sentry in production

### AI Agent (Python)
- Use `try/except` with specific exception types, never bare `except:`
- Return structured error responses via Pydantic models
- Retry transient failures (network, timeout) with exponential backoff
- Log all external API failures with request context

## Logging

- **Backend**: Use NestJS `Logger` per class — `private readonly logger = new Logger(ClassName.name)`
- **Frontend**: Console in dev only; Sentry in production
- **AI Agent**: Python `structlog` with JSON output
- Include correlation IDs (request ID, user ID) in all log entries
- Never log secrets, tokens, or full request bodies containing PII

## Module Patterns

### NestJS Module Structure
Every feature module follows this layout:
```
feature/
├── feature.module.ts       # Module definition
├── feature.controller.ts   # HTTP endpoints
├── feature.service.ts      # Business logic
├── feature.repository.ts   # Data access (optional, for complex queries)
├── dto/
│   ├── create-feature.dto.ts
│   └── update-feature.dto.ts
├── entities/
│   └── feature.entity.ts   # Prisma-generated types or custom interfaces
└── feature.spec.ts         # Unit tests
```

### React Component Pattern
```typescript
// components/feature/FeatureName.tsx
'use client'

import { useTranslations } from 'next-intl'

interface FeatureNameProps {
  id: string
  onAction?: () => void
}

export function FeatureName({ id, onAction }: FeatureNameProps) {
  const t = useTranslations('feature')
  // ...
}
```

### React Query Hook Pattern
```typescript
// hooks/use-feature.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useFeature(id: string) {
  return useQuery({
    queryKey: ['feature', id],
    queryFn: () => api.get(`/v1/features/${id}`).then(r => r.data.data),
  })
}

export function useCreateFeature() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateFeatureDto) => api.post('/v1/features', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feature'] }),
  })
}
```

## Validation

### Backend DTOs
Every DTO property MUST have class-validator decorators:
```typescript
export class CreateBookingDto {
  @IsUUID()
  tripId: string

  @IsInt()
  @Min(1)
  @Max(20)
  participants: number

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string
}
```

### Frontend Forms
Always use React Hook Form + Zod:
```typescript
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

type FormData = z.infer<typeof schema>
```

## Import Ordering

### TypeScript (Frontend & Backend)
1. Node/framework built-ins (`react`, `next`, `@nestjs/*`)
2. Third-party packages (`@tanstack/react-query`, `zod`)
3. Internal aliases (`@/components/*`, `@/lib/*`)
4. Relative imports (`./`, `../`)
5. Type-only imports last (`import type { ... }`)

Blank line between each group.

## Naming Rules

| Context | Convention | Example |
|---------|-----------|---------|
| React components | PascalCase | `ChatWindow.tsx` |
| Utility files | kebab-case | `api-client.ts` |
| Zustand stores | `feature.store.ts` | `auth.store.ts` |
| NestJS services | `feature.service.ts` | `booking.service.ts` |
| NestJS controllers | `feature.controller.ts` | `booking.controller.ts` |
| DTOs | `verb-feature.dto.ts` | `create-booking.dto.ts` |
| Hooks | `use-feature.ts` | `use-booking.ts` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| DB tables | snake_case | `trip_packages` |
| API routes | kebab-case plural | `/v1/trip-packages` |
| Env vars | UPPER_SNAKE_CASE | `DATABASE_URL` |

## API Response Envelope

All backend responses follow this shape:
```typescript
{
  success: boolean
  data: T | null
  message: string
  error?: string
}
```

Pagination responses add:
```typescript
{
  success: true
  data: T[]
  message: string
  meta: { page: number, limit: number, total: number, totalPages: number }
}
```

## Testing

- **Unit tests**: Co-located with source (`feature.spec.ts`)
- **E2E tests**: In `test/` directory at project root
- **Naming**: `describe('FeatureService')` → `it('should create booking when valid')`
- **Mocking**: Use Jest mocks for external services, never hit real APIs in tests
- **Coverage target**: 80% for services, 60% for controllers

## Performance Rules

- Prisma queries MUST use `select` or `include` — no implicit full-row fetches
- All list endpoints MUST support pagination (default: 20, max: 100)
- Use Redis caching for data that changes less than once per minute
- Frontend images MUST use `next/image` with explicit dimensions
- Lazy-load below-the-fold components with `dynamic()` or `React.lazy()`

## Security Checklist (Every PR)

- [ ] No hardcoded secrets or API keys
- [ ] All user inputs validated via DTOs or Zod
- [ ] Auth guards on protected endpoints
- [ ] Rate limiting on new endpoints (`@Throttle()`)
- [ ] No raw SQL — use Prisma parameterized queries
- [ ] Sensitive data not logged
