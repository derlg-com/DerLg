---
inclusion: always
---

# Technology Stack

## Architecture

Three-tier architecture with separate frontend, backend API, and AI agent services.

```
Frontend (Next.js) ←→ Backend API (NestJS) ←→ Database (Supabase PostgreSQL)
                            ↕
                    AI Agent (Python/FastAPI)
                            ↕
                    LLM (Claude Sonnet 4.5)
```

## Frontend

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **State Management**: Zustand (client state), React Query (server state)
- **Forms**: React Hook Form + Zod validation
- **Maps**: Leaflet.js + OpenStreetMap
- **i18n**: next-intl (EN/ZH/KM)
- **PWA**: Service Worker for offline capability

## Backend

- **Framework**: NestJS
- **Language**: TypeScript
- **Database**: PostgreSQL via Supabase
- **ORM**: Prisma
- **Cache/Sessions**: Redis (Upstash)
- **Auth**: Supabase Auth + JWT
- **Validation**: class-validator + class-transformer
- **Testing**: Jest

## AI Agent

- **Framework**: FastAPI (Python)
- **Agent Framework**: LangGraph (state machine orchestration)
- **LLM**: Claude Sonnet 4.5 (Anthropic API)
- **Session Storage**: Redis (7-day TTL)
- **Communication**: WebSocket (chat), HTTP (tool calls to backend)

## Third-Party Services

- **Payments**: Stripe (+ Bakong QR for Cambodia)
- **Email**: Resend
- **Push Notifications**: Firebase Cloud Messaging (FCM)
- **Maps/Places**: Google Maps API
- **Weather**: OpenWeatherMap API
- **Currency**: ExchangeRate-API
- **Storage**: Supabase Storage
- **Error Tracking**: Sentry

## Common Commands

### Frontend (in `frontend/`)
```bash
npm run dev          # Start development server (localhost:3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Backend (in `backend/`)
```bash
npm run start:dev    # Start with hot reload
npm run build        # Compile TypeScript
npm run start:prod   # Start production build
npm run test         # Run unit tests
npm run test:e2e     # Run end-to-end tests
npm run test:cov     # Run tests with coverage
npm run lint         # Run ESLint with auto-fix
npm run format       # Format code with Prettier
```

### Database (Prisma)
```bash
npx prisma generate  # Generate Prisma Client
npx prisma migrate dev  # Create and apply migration
npx prisma studio    # Open Prisma Studio GUI
npx prisma db push   # Push schema without migration
```

## Code Style

- **TypeScript**: Strict mode enabled
- **Formatting**: Prettier (2 spaces, single quotes, no semicolons for frontend; semicolons for backend)
- **Linting**: ESLint with recommended rules
- **Naming Conventions**:
  - Components: PascalCase (e.g., `ChatWindow.tsx`)
  - Files: kebab-case for utilities (e.g., `api-client.ts`)
  - Variables/functions: camelCase
  - Constants: UPPER_SNAKE_CASE
  - Database tables: snake_case

## API Conventions

- **Base URL**: `/v1/` prefix for all endpoints
- **Response Envelope**: `{ success, data, message, error }`
- **Auth**: Bearer JWT in Authorization header
- **Validation**: DTOs with class-validator decorators
- **Error Codes**: HTTP standard codes + custom error enums

## Security Requirements

- Never hardcode API keys or secrets
- All user inputs must be validated via DTOs
- Rate limiting on all endpoints
- JWT tokens expire after 15 minutes
- Stripe webhooks must verify signatures
- Row-Level Security (RLS) enabled on Supabase
- AI agent cannot write directly to database (only via backend API)
