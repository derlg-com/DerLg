---
inclusion: always
---

# Project Structure

## Repository Layout

```
derlg/
├── frontend/              # Next.js 14 application
├── backend/               # NestJS API server
├── llm_agentic_chatbot/   # Python AI agent service
├── docs/                  # Technical documentation
│   ├── architectures/     # System design documents
│   ├── backend/           # Backend API specifications
│   ├── frontend/          # Frontend feature specifications
│   ├── agentic_chatbots_llm/  # AI agent documentation
│   ├── features/          # Feature index and details
│   └── mcp_server/        # MCP server documentation
└── .kiro/                 # Kiro configuration
    ├── specs/             # Feature specs and tasks
    ├── steering/          # AI assistant guidance
    ├── hooks/             # Agent hooks
    └── settings/          # Tool settings (MCP, etc.)
```

## Frontend Structure (`frontend/`)

```
frontend/
├── app/                   # Next.js App Router
│   ├── (public)/          # Marketing pages (SSR)
│   │   ├── page.tsx       # Landing page
│   │   ├── explore/       # Place discovery
│   │   └── blog/          # Content pages
│   ├── (auth)/            # Authentication flows
│   │   ├── login/
│   │   ├── register/
│   │   └── reset-password/
│   └── (app)/             # Authenticated app (CSR)
│       ├── home/          # Dashboard
│       ├── explore/       # Places and festivals
│       ├── booking/       # Booking hub
│       ├── chat/          # AI chat interface
│       ├── my-trips/      # Active and past bookings
│       └── profile/       # User settings
├── components/
│   ├── layout/            # AppShell, BottomNav, TopBar
│   ├── booking/           # Booking-related components
│   ├── chat/              # Chat UI components
│   ├── explore/           # Place cards and galleries
│   ├── shared/            # Reusable components
│   └── ui/                # shadcn/ui base components
├── lib/
│   ├── api.ts             # Axios client + React Query
│   ├── websocket.ts       # WebSocket manager
│   ├── i18n.ts            # Internationalization
│   ├── offline.ts         # Service worker helpers
│   └── currency.ts        # Currency utilities
├── stores/                # Zustand state stores
│   ├── auth.store.ts
│   ├── booking.store.ts
│   ├── chat.store.ts
│   └── language.store.ts
└── public/
    ├── locales/           # Translation files (en/km/zh)
    └── offline/maps/      # Cached map tiles
```

## Backend Structure (`backend/`)

```
backend/
├── src/
│   ├── main.ts            # NestJS bootstrap
│   ├── app.module.ts      # Root module
│   ├── auth/              # Authentication & JWT
│   ├── users/             # User management
│   ├── trips/             # Trip packages catalog
│   ├── bookings/          # Booking lifecycle
│   ├── payments/          # Stripe integration
│   ├── transportation/    # Van, bus, tuk-tuk
│   ├── hotels/            # Hotel management
│   ├── guides/            # Tour guide management
│   ├── explore/           # Places and culture
│   ├── festivals/         # Festival calendar
│   ├── emergency/         # Emergency alerts
│   ├── student-discount/  # Student verification
│   ├── loyalty/           # Points and rewards
│   ├── notifications/     # Push and email
│   ├── currency/          # Exchange rates
│   ├── ai-tools/          # AI agent tool endpoints
│   ├── common/            # Guards, interceptors, filters
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── filters/
│   │   ├── decorators/
│   │   └── pipes/
│   └── config/            # Configuration modules
└── test/                  # E2E tests
```

## AI Agent Structure (`llm_agentic_chatbot/`)

```
llm_agentic_chatbot/
├── src/
│   ├── main.py            # FastAPI application
│   ├── agent/
│   │   ├── state_machine.py   # LangGraph state machine
│   │   ├── tools.py           # Tool definitions
│   │   ├── prompts.py         # System prompts
│   │   └── nodes.py           # State machine nodes
│   ├── websocket/
│   │   └── chat_handler.py    # WebSocket connection manager
│   ├── services/
│   │   ├── claude_client.py   # Anthropic API client
│   │   ├── redis_client.py    # Session storage
│   │   └── backend_client.py  # HTTP client for backend
│   └── models/
│       ├── conversation.py    # Conversation state models
│       └── messages.py        # Message schemas
└── tests/
```

## Documentation Structure (`docs/`)

- **architectures/**: High-level system design and technology decisions
- **backend/**: API endpoint specifications, database schema, module documentation
- **frontend/**: Screen-by-screen UI/UX specifications
- **agentic_chatbots_llm/**: AI agent behavior, state machine, tool calling
- **features/**: User-facing feature descriptions and flows
- **mcp_server/**: Model Context Protocol server documentation

## Module Organization Principles

### Frontend
- Route-based code splitting (each page is a separate bundle)
- Shared components in `components/shared/`
- Feature-specific components in feature folders
- Global state in Zustand stores
- Server state via React Query hooks

### Backend
- One module per domain (auth, bookings, payments, etc.)
- Each module contains: controller, service, DTOs, entities
- Shared utilities in `common/`
- Configuration in `config/`
- Database access only through Prisma

### AI Agent
- State machine logic in `agent/`
- Tool implementations call backend HTTP endpoints
- No direct database access
- Session state persisted in Redis
- WebSocket handler manages real-time chat

## File Naming Conventions

- **Components**: `PascalCase.tsx` (e.g., `ChatWindow.tsx`)
- **Utilities**: `kebab-case.ts` (e.g., `api-client.ts`)
- **Stores**: `feature.store.ts` (e.g., `auth.store.ts`)
- **Pages**: `page.tsx` (Next.js App Router convention)
- **Modules**: `feature.module.ts` (NestJS convention)
- **Services**: `feature.service.ts`
- **Controllers**: `feature.controller.ts`
- **DTOs**: `feature.dto.ts`

## Import Path Conventions

### Frontend
- Use relative imports for same-feature files
- Use `@/` alias for absolute imports from root
- Example: `import { Button } from '@/components/ui/button'`

### Backend
- Use relative imports within same module
- Use absolute imports for cross-module dependencies
- Example: `import { AuthGuard } from 'src/common/guards/auth.guard'`

## Environment Files

- `.env.local` (frontend): Next.js environment variables
- `.env` (backend): NestJS environment variables
- `.env` (AI agent): Python service environment variables
- Never commit `.env` files (use `.env.example` as template)
