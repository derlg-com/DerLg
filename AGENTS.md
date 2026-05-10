# DerLg — Agent Development Guide

> **DerLg** is a Cambodia travel booking platform with an AI-powered "Vibe Booking" feature. It is a full-stack application composed of a Next.js frontend, a NestJS backend, and a planned Python AI agent service.
> 
> **Current state:** The project is in early scaffolding. Both the frontend and backend are mostly default boilerplate from `create-next-app` and the NestJS CLI. Extensive planning docs live in `docs/` and `.kiro/specs/`, but implementation work has not yet begun in earnest.

---

## Project Overview

| Aspect | Detail |
|--------|--------|
| **Product** | Mobile-first PWA for booking trips, hotels, transportation, and tour guides in Cambodia, with a conversational AI concierge |
| **Target users** | International tourists, Chinese tourists (primary market), students, safety-conscious travelers |
| **Languages** | English (EN), Chinese (ZH), Khmer (KM) |
| **Repo layout** | Monorepo with `frontend/`, `backend/`, `docs/`, and `.kiro/` |

### High-level architecture (planned)

```
┌──────────────┐     REST      ┌──────────────┐     Tools     ┌──────────────┐
│  Next.js     │ ◄──────────► │   NestJS     │ ◄──────────► │ Python AI    │
│  (Frontend)  │   (/v1/*)    │  (Backend)   │   (/v1/ai-tools/*) │  (LangGraph) │
│  Port 3000   │              │  Port 3001   │              │              │
└──────────────┘              └──────┬───────┘              └──────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
              ┌──────────┐    ┌──────────┐    ┌──────────┐
              │ Supabase │    │  Redis   │    │  Stripe  │
              │   (PG)   │    │ (Cache)  │    │(Payments)│
              └──────────┘    └──────────┘    └──────────┘
```

---

## Technology Stack

### Frontend (`frontend/`)
- **Framework:** Next.js 16.2.6 with App Router
- **Language:** TypeScript 5 (strict mode enabled)
- **React:** 19.2.4
- **Styling:** Tailwind CSS v4
- **Fonts:** Geist (via `next/font/google`)
- **Planned additions:** shadcn/ui, Zustand, React Query, Leaflet.js, next-intl

### Backend (`backend/`)
- **Framework:** NestJS 11
- **Language:** TypeScript 5.7.3
- **Testing:** Jest 30, ts-jest, Supertest
- **Linting:** ESLint 9 with `typescript-eslint` recommended-type-checked
- **Formatting:** Prettier 3 (single quotes, trailing commas)
- **Planned additions:** Prisma ORM, class-validator, class-transformer, Passport, Stripe SDK

### Data & Infrastructure (planned)
- **Database:** PostgreSQL via Supabase (production), Docker `postgres:15-alpine` (dev)
- **ORM:** Prisma
- **Cache / Sessions:** Redis (Upstash in production, Docker `redis:7-alpine` in dev)
- **Storage:** Supabase Storage
- **Payments:** Stripe + Bakong/ABA QR codes
- **Email:** Resend
- **Push:** Firebase Cloud Messaging (FCM)
- **AI:** Claude Sonnet via LangGraph (Python FastAPI service)

---

## Build and Test Commands

### Frontend
Run these from the `frontend/` directory:

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Next.js dev server on `http://localhost:3000` |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

### Backend
Run these from the `backend/` directory:

| Command | Purpose |
|---------|---------|
| `npm run start:dev` | NestJS with hot reload (`--watch`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start:prod` | Run compiled app (`node dist/main`) |
| `npm run start` | Standard NestJS start (no watch) |
| `npm run test` | Run Jest unit tests (`*.spec.ts` in `src/`) |
| `npm run test:watch` | Jest in watch mode |
| `npm run test:cov` | Jest with coverage report to `coverage/` |
| `npm run test:e2e` | Run E2E tests (`*.e2e-spec.ts` in `test/`) |
| `npm run lint` | ESLint with auto-fix on `src/`, `apps/`, `libs/`, `test/` |
| `npm run format` | Prettier write on `src/**/*.ts` and `test/**/*.ts` |

### Database (planned — Prisma)
| Command | Purpose |
|---------|---------|
| `npx prisma generate` | Generate Prisma Client |
| `npx prisma migrate dev` | Create and apply migration |
| `npx prisma studio` | Open Prisma Studio GUI |
| `npx prisma db push` | Push schema without migration |

---

## Code Organization

### Frontend (`frontend/`)
```
frontend/
├── app/              # Next.js App Router (pages, layouts)
│   ├── layout.tsx    # Root layout with Geist fonts
│   ├── page.tsx      # Landing page (currently default boilerplate)
│   └── globals.css   # Tailwind CSS entry + CSS variables
├── public/           # Static assets
├── package.json
├── tsconfig.json     # strict: true, paths: { "@/*": ["./*"] }
└── next.config.ts    # Next.js configuration
```

**Planned structure (not yet created):**
- `app/(public)/` — marketing pages (SSR)
- `app/(auth)/` — login, register, reset-password
- `app/(app)/` — authenticated app shell (home, explore, booking, chat, my-trips, profile)
- `components/ui/` — shadcn/ui base components
- `components/shared/` — reusable cross-feature components
- `lib/` — api client, WebSocket manager, i18n, offline helpers, currency utilities
- `stores/` — Zustand stores (auth, booking, chat, language)

### Backend (`backend/`)
```
backend/
├── src/
│   ├── main.ts              # NestJS bootstrap (listens on PORT or 3000)
│   ├── app.module.ts        # Root module (currently empty imports)
│   ├── app.controller.ts    # Default "Hello World" controller
│   ├── app.service.ts       # Default service
│   └── app.controller.spec.ts # Default unit test
├── test/
│   ├── app.e2e-spec.ts      # Default E2E test
│   └── jest-e2e.json        # E2E Jest config
├── package.json
├── tsconfig.json            # nodenext, ES2023, emitDecoratorMetadata
├── nest-cli.json            # deleteOutDir: true
├── eslint.config.mjs        # ESLint 9 + typescript-eslint + Prettier
└── .prettierrc              # singleQuote: true, trailingComma: all
```

**Planned modules (not yet created):**
`auth`, `users`, `trips`, `bookings`, `payments`, `transportation`, `hotels`, `guides`, `explore`, `festivals`, `emergency`, `student-discount`, `loyalty`, `notifications`, `currency`, `ai-tools`, plus `common/` (guards, interceptors, filters, decorators, pipes) and `config/`.

### Documentation (`docs/`)
- `product/prd.md` — Product Requirements Document (high-level product truth)
- `platform/architecture/system-overview.md` — System architecture, auth flow, payment flow, real-time channels
- `product/feature-decisions.md` — Canonical feature registry with scope, priority, status, owner
- `modules/` — Per-feature API specs (`api.yaml`), architecture, and requirements
- `modules/README.md` — Feature module index
- `glossary.md` — Domain terms and abbreviations

### Kiro Configuration (`.kiro/`)
- `.kiro/steering/tech.md` — Technology stack decisions and common commands
- `.kiro/steering/structure.md` — Planned directory structure and naming conventions
- `.kiro/steering/product.md` — Product context
- `.kiro/specs/` — Detailed implementation specs for each workstream:
  - `backend-nestjs-supabase/`
  - `frontend-nextjs-implementation/`
  - `agentic-llm-chatbot/`
  - `system-admin-panel/`
  - `qa-testing-comprehensive/`
  - `chatbot-bug-testing-fixes/`

---

## Code Style Guidelines

### TypeScript
- **Frontend:** `strict: true` (enforced in `tsconfig.json`)
- **Backend:** `strictNullChecks: true`, `noImplicitAny: false`, `strictBindCallApply: false`

### Formatting
- **Backend:** Prettier with `singleQuote: true`, `trailingComma: "all"`
- **Frontend:** No Prettier config committed yet; plan is 2 spaces, single quotes, no semicolons
- **Backend ESLint:** `@typescript-eslint/no-explicit-any: off`, `@typescript-eslint/no-floating-promises: warn`, `prettier/prettier: error`

### Naming Conventions
| Category | Convention | Example |
|----------|------------|---------|
| React components | PascalCase | `ChatWindow.tsx` |
| Utilities / helpers | kebab-case | `api-client.ts` |
| Variables / functions | camelCase | `getUserProfile` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| NestJS modules | feature.module.ts | `auth.module.ts` |
| NestJS services | feature.service.ts | `auth.service.ts` |
| NestJS controllers | feature.controller.ts | `auth.controller.ts` |
| NestJS DTOs | feature.dto.ts | `create-user.dto.ts` |
| Database tables | snake_case | `hotel_rooms` |
| Zustand stores | feature.store.ts | `auth.store.ts` |

### Import Conventions
- **Frontend:** Use `@/` alias for absolute imports from project root. Use relative imports within the same feature.
- **Backend:** Use relative imports within the same module; use absolute imports (`src/...`) for cross-module dependencies.

### API Conventions (planned)
- Base URL prefix: `/v1/`
- Response envelope: `{ success, data, message, error }`
- Auth: Bearer JWT in `Authorization` header
- Validation: DTOs with `class-validator` decorators
- Error codes: HTTP standard codes + custom error enums

---

## Testing Instructions

### Backend
- **Unit tests:** Colocated or alongside source files, named `*.spec.ts`. Jest config is inline in `package.json`.
  - `rootDir`: `src`
  - `testRegex`: `.*\.spec\.ts$`
  - `transform`: `ts-jest`
  - `coverageDirectory`: `../coverage`
  - `testEnvironment`: `node`
- **E2E tests:** Located in `test/`, named `*.e2e-spec.ts`. Uses separate `jest-e2e.json` config with `rootDir: "."`.
- Run tests from the `backend/` directory.

### Frontend
- No testing framework is currently installed. The plan includes adding Jest or Vitest + React Testing Library.

---

## Security Considerations

- Never hardcode API keys or secrets. All sensitive configuration must be environment variables.
- Environment files (`.env`, `.env.local`, `.env.*.local`) are gitignored.
- Required backend env vars (planned): `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `AI_SERVICE_KEY`, `REDIS_URL`
- All user inputs must be validated via DTOs (`class-validator`).
- Rate limiting is required on all public endpoints (auth endpoints planned at 5 requests / 5 min / IP).
- JWT access tokens expire after 15 minutes; refresh tokens expire after 7 days and are stored in `httpOnly Secure SameSite=Strict` cookies.
- Stripe webhooks must verify signatures.
- Supabase Row-Level Security (RLS) must be enabled.
- The AI agent is not allowed to write directly to the database; it must call backend `/v1/ai-tools/*` endpoints with a service key (`X-Service-Key` header).
- CORS must be whitelisted to production origins only.

---

## Environment Setup

1. **Install dependencies**
   ```bash
   cd frontend && npm install
   cd ../backend && npm install
   ```

2. **Run frontend dev server**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Run backend dev server**
   ```bash
   cd backend
   npm run start:dev
   ```

4. **Full-stack Docker Compose** (planned)
   A `docker-compose.yml` is planned to spin up PostgreSQL, Redis, Backend, Frontend, and the AI chatbot with hot reload enabled.

---

## Key External Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- For detailed acceptance criteria and design decisions, see `.kiro/specs/*/requirements.md` and `.kiro/specs/*/design.md`.
