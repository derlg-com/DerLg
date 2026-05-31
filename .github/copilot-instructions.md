# Copilot Instructions for DerLg

## Build, Test & Lint Commands

### Frontend (`frontend/`)
- **Development server**: `npm run dev`
- **Production build**: `npm run build`
- **Start production server**: `npm run start`
- **Lint**: `npm run lint`
- **Run tests** (Vitest): `npm run test`
- **Run a single test file**: `npx jest path/to/file.test.ts` (or `npm test -- path/to/file.test.ts`)
- **Watch tests**: `npm run test:watch`
- **Coverage**: `npm run test:coverage`

### Backend (`backend/`)
- **Compile**: `npm run build`
- **Start dev server (watch mode)**: `npm run start:dev`
- **Start production server**: `npm run start:prod`
- **Lint**: `npm run lint`
- **Format**: `npm run format`
- **Run all unit tests**: `npm run test`
- **Run a single test file**: `npx jest src/path/to/file.spec.ts`
- **Watch tests**: `npm run test:watch`
- **Coverage**: `npm run test:cov`
- **Run E2E tests**: `npm run test:e2e`

## High‑Level Architecture

```
┌──────────────┐   REST   ┌──────────────┐   Tools   ┌──────────────┐
│  Next.js     │◄──────► │  NestJS      │◄──────► │ Python AI    │
│  Frontend   │ (/v1/*) │  Backend    │(/v1/ai-tools/*)│ LangGraph   │
│  Port 3000   │          │  Port 3001   │          │ FastAPI      │
└──────────────┘          └──────┬───────┘          └──────────────┘
                           │
            ┌──────────────┼───────────────┐
            ▼              ▼               ▼
   ┌───────────┐   ┌───────────┐   ┌───────────┐
   │ Supabase  │   │  Redis    │   │ Stripe    │
   │ (Postgres)│   │ (Cache)   │   │ (Payments)│
   └───────────┘   └───────────┘   └───────────┘
```
- **Frontend ↔ Backend**: REST JSON with `{ success, data, message, error }` envelope, base path `/v1/`. Auth via Bearer JWT.
- **Frontend ↔ AI Agent**: WebSocket chat, messages include text, cards, actions, QR codes.
- **AI Agent ↔ Backend**: REST tool endpoints protected by `X-Service-Key`.
- **External services**: Stripe, Supabase storage, Redis, email (Resend), push (FCM), maps (Leaflet/OpenStreetMap).

## Key Conventions

### Naming & File Layout
- **React components** – `PascalCase.tsx` (e.g., `ChatWindow.tsx`).
- **Utility / helper files** – `kebab-case.ts` (e.g., `api-client.ts`).
- **Zustand stores** – `<feature>.store.ts` (e.g., `auth.store.ts`).
- **NestJS modules/services/controllers/DTOs** – `<feature>.module.ts`, `<feature>.service.ts`, `<feature>.controller.ts`, `<verb>-<feature>.dto.ts`.
- **Database tables** – `snake_case` (e.g., `hotel_rooms`).
- **API routes** – kebab‑case plural under `/v1/` (e.g., `/v1/trip-packages`).
- **Environment variables** – `UPPER_SNAKE_CASE` (e.g., `DATABASE_URL`).

### Import Ordering (TS/JS)
1. Node/framework built‑ins (`react`, `next`, `@nestjs/*`).
2. Third‑party packages (`@tanstack/react-query`, `zod`).
3. Internal aliases (`@/components/*`, `@/lib/*`).
4. Relative imports (`./`, `../`).
5. Type‑only imports (`import type { … }`).
Blank line between groups.

### API Response Envelope (Backend)
```json
{
  "success": true,
  "data": <payload> | null,
  "message": "<human readable>",
  "error?: "<error string>"
}
```
Paginated list responses add a `meta` object with `page`, `limit`, `total`, `totalPages`.

### Validation
- **Backend DTOs** – use `class-validator` decorators (`@IsUUID()`, `@IsInt()`, `@Min`, `@Max`, `@IsOptional`, etc.).
- **Frontend forms** – React Hook Form + Zod schemas.

### Error Handling
- **Backend** – throw NestJS built‑in exceptions (`NotFoundException`, `BadRequestException`, …) or custom exception filters. Include meaningful messages and log with `this.logger.error(..., { userId, ... })`.
- **Frontend** – error boundaries for component failures; API errors handled in React Query's `error` callback; show user‑friendly toast, log to Sentry in prod.
- **AI Agent** – specific `try/except` blocks, return structured Pydantic error models, retry transient failures.

### Module Patterns
- **NestJS feature module**:
  ```
  feature/
  ├─ feature.module.ts
  ├─ feature.controller.ts
  ├─ feature.service.ts
  ├─ dto/
  │   ├─ create-feature.dto.ts
  │   └─ update-feature.dto.ts
  ├─ entities/
  │   └─ feature.entity.ts
  └─ feature.spec.ts
  ```
- **React component** – colocated in `components/<feature>/FeatureName.tsx` with `use client` directive when needed.
- **React Query hook** – `hooks/use-feature.ts` returning `useQuery`/`useMutation` with proper query keys.

### Logging & Security
- **Backend** – `Logger` per class (`private readonly logger = new Logger(ClassName.name)`). Include correlation IDs, never log secrets or PII.
- **Frontend** – console in dev, Sentry in production.
- **AI Agent** – `structlog` JSON output, include request IDs.
- **Security checklist** – no hard‑coded secrets, DTO validation, auth guards, rate limiting, Prisma parameterized queries, no raw SQL, no secret logging.

### Testing Guidelines
- **Backend unit tests** – colocated `*.spec.ts` under `src/`; run via `npm run test`.
- **Backend E2E tests** – placed in `test/` with `*.e2e-spec.ts`; run via `npm run test:e2e`.
- **Frontend** – planned Vitest + React Testing Library; single test run via `npm test -- path/to/file.test.ts`.
- **Coverage targets** – 80 % services, 60 % controllers, 80 % unit, 70 % E2E.

## Additional AI‑Assistant Configs
- **Claude guidance** – see `CLAUDE.md` for agent‑specific rules.
- **Kiro conventions** – see `.kiro/steering/conventions.md` for error handling, import ordering, and module layout.
- No `.cursor` or `.windsurfrules` files exist in this repo.

---

*This file is consumed by GitHub Copilot for context‑aware suggestions. Keep it up‑to‑date as the project evolves.*
