# DerLg — Agent Orchestrator

> **DerLg** is a Cambodia travel booking platform with an AI-powered "Vibe Booking" feature.
> It is a full-stack monorepo composed of a **Next.js frontend**, a **NestJS backend**, and a **Python AI agent service**.
>
> **This file is the Orchestrator.** If you are an AI agent about to work on this project, your first step is to identify which layer you are implementing and follow the routing instructions below.

---

## Project Overview

| Aspect | Detail |
|--------|--------|
| **Product** | Mobile-first PWA for booking trips, hotels, transportation, and tour guides in Cambodia, with a conversational AI concierge |
| **Target users** | International tourists, Chinese tourists (primary market), students, safety-conscious travelers |
| **Languages** | English (EN), Chinese (ZH), Khmer (KM) |
| **Repo layout** | Monorepo with `frontend/`, `backend/`, `vibe-booking/`, `docs/`, and `.kiro/` |

### High-level architecture (planned)

```
┌──────────────┐     REST      ┌──────────────┐     Tools    ┌──────────────┐
│  Next.js     │ ◄──────────►  │   NestJS     │ ◄──────────► │ Python AI    │
│  (Frontend)  │   (/v1/*)     │  (Backend)   │   (/v1/ai-tools/*) │  (LangGraph) │
│  Port 3000   │               │  Port 3001   │              │              │
└──────────────┘               └──────┬───────┘              └──────────────┘
                                     │
                    ┌────────────────┼────────────────┬────────────────┐
                    ▼                ▼                ▼                ▼
              ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
              │ Supabase │    │  Redis   │    │  Stripe  │    │  MinIO   │
              │   (PG)   │    │ (Cache)  │    │(Payments)│    │ (Images, │
              └──────────┘    └──────────┘    └──────────┘    │  Media)  │
                                                              └──────────┘
```

---

## Agent Routing — READ THIS FIRST

### 1. Implementing the Backend?
→ **Read `@backend/AGENTS.md`** for detailed backend conventions, NestJS patterns, module structure, API standards, and Prisma/Supabase guidelines.

→ **Then read the spec directory:**
- `.kiro/specs/backend-nestjs-supabase/` — implementation tasks, API contracts, database schema decisions, and acceptance criteria.

### 2. Implementing the Frontend?
→ **Read `@frontend/AGENTS.md`** for detailed frontend conventions, Next.js App Router patterns, Tailwind/shadcn/ui rules, and component organization.

→ **Then read the spec directories:**
- `.kiro/specs/frontend-nextjs-implementation/` — core frontend build tasks, routing, state management, and shared components.
- `.kiro/specs/vibe-booking-frontend/` — Vibe Booking UI-specific tasks, chat interface, and AI concierge frontend integration.

### 3. Implementing the Vibe Booking AI Agent?
→ **Read `@vibe-booking/AGENT.md`** for detailed agent architecture, LangGraph workflow design, Python service conventions, tool definitions, and memory patterns.

→ **Then read the spec directories:**
- `.kiro/specs/vibe-booking/` — AI agent implementation tasks, LangGraph node definitions, tool calling specs, and backend integration contract.
- `.kiro/specs/vibe-booking-frontend/` — how the AI agent interfaces with the frontend chat UI.

---

## Cross-Cutting Conventions (Global)

These rules apply to **all** layers regardless of which agent is working:

- **Language:** TypeScript 5 (frontend & backend), Python 3.12+ (AI agent).
- **Never hardcode secrets.** All API keys, tokens, and credentials must be environment variables.
- **Environment files** (`.env`, `.env.local`, `.env.*.local`) are gitignored — do not commit them.
- **API base prefix:** `/v1/` (backend) and `/v1/ai-tools/*` (AI service endpoints).
- **Response envelope:** `{ success, data, message, error }` (backend).
- **Auth:** Bearer JWT in `Authorization` header; `httpOnly Secure SameSite=Strict` cookies for refresh tokens.
- **Naming:** React components `PascalCase`, utilities `kebab-case`, variables/functions `camelCase`, constants `UPPER_SNAKE_CASE`, DB tables `snake_case`.
- **CORS** must be whitelisted to production origins only.

---

## Quick-Reference: Stack & Ports

| Layer | Tech | Dev Port | Directory |
|-------|------|----------|-----------|
| Frontend | Next.js 16 + React 19 + Tailwind v4 | `3000` | `frontend/` |
| Backend | NestJS 11 + Prisma + Supabase PG | `3001` | `backend/` |
| AI Agent | Python + LangGraph + FastAPI | TBD | `vibe-booking/` |
| Cache | Redis (Upstash prod / Docker dev) | `6379` | — |
| Storage | MinIO (self-hosted Docker) | `9000` | — |
| DB | PostgreSQL via Supabase | `5432` | — |

---

## Documentation Index

| Document | Purpose |
|----------|---------|
| `docs/product/prd.md` | Product Requirements Document |
| `docs/platform/architecture/system-overview.md` | Auth flow, payment flow, real-time channels |
| `docs/product/feature-decisions.md` | Canonical feature registry (scope, priority, status, owner) |
| `docs/modules/README.md` | Per-feature API specs index |
| `.kiro/steering/tech.md` | Technology stack decisions |
| `.kiro/steering/structure.md` | Planned directory structure & naming conventions |
| `.kiro/steering/product.md` | Product context |


<claude-mem-context>
# Memory Context

# [DerLg] recent context, 2026-05-28 10:47pm GMT+7

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (15,594t read) | 125,543t work | 88% savings

### May 17, 2026
S49 Implement Vibe Booking frontend at /home/rayu/DerLg/frontend/ that talks to the vibe-booking AI agent (ws://localhost:8000) and aligns with the NestJS backend at /home/rayu/DerLg/vibe-booking — no sign-in/sign-up; guest user only. Replayed pre-compaction trajectory through compilation, runtime smoke test, and task-6 closure. (May 17, 5:29 PM)
S48 Integrate the NestJS backend with the vibe-booking Python AI agent per the .kiro/specs design docs — implement the 9 `/v1/ai-tools/*` endpoints, the service-key guard, and reconcile the agent's TOOL_DISPATCH paths. (May 17, 5:39 PM)
S50 Debug agent run_agent() KeyError: 'name' crash in NVIDIA client and confirm WebSocket response wrapping pattern (May 17, 5:47 PM)
S51 Vibe Booking frontend WebSocket integration — fix empty content cards and verify end-to-end agent chat flow (May 17, 6:23 PM)
S55 Populate remaining Prisma seed files and run full database seed for DerLg backend (May 17, 6:29 PM)
### May 18, 2026
S65 Launch all three services (vibe-booking FastAPI agent, NestJS backend, Next.js frontend) so the vibe booking feature can be tested end-to-end in local dev (May 18, 9:38 AM)
S66 Launch all three services (vibe-booking FastAPI agent, NestJS backend, Next.js frontend) and make the vibe booking feature testable end-to-end at the root URL (May 18, 11:19 AM)
S67 Vibe-Booking AI chat WebSocket failed in the browser with the static frame "Something went wrong. Please try again." on every user turn; the outage was traced to a stale shell-exported NVIDIA_API_KEY shadowing the project's .env, causing every NVIDIA NIM chat-completions call to come back HTTP 403 Forbidden, and was resolved operationally by relaunching the FastAPI uvicorn server with the conflicting env vars unset so pydantic-settings would fall through to the correct key in /home/rayu/DerLg/vibe-booking/.env. (May 18, 11:23 AM)
S100 User asked the primary session's Claude agent to implement all tasks from `/home/rayu/DerLg/.kiro/specs/vibe-booking-final/tasks.md` and requested clarification on what additional information is needed to complete the implementation. (May 18, 11:59 AM)
### May 25, 2026
S101 Verify and track progress on the vibe-booking dual-payment travel booking feature implementation — comprehensive testing and task tracking across frontend (React), backend (Python), and AI agent (LangGraph) services. User has been systematically checking off completed implementation tasks in the specification file. (May 25, 9:18 AM)
828 9:33a ✅ Added Missing Chinese Translations to Chinese Message File
830 9:34a ✅ Completed Khmer Translations for All Missing Translation Keys
831 " ✅ Marked Phase 16 Tasks as Complete
832 " ✅ Marked Phase 16/17 Implementation Tasks as In Progress
833 " 🔵 SplitScreenLayout ChatPanel Has Dialog Role but No Focus Trap Implementation
834 " 🟣 Implemented useFocusTrap Hook for Modal Focus Management
835 9:35a ✅ Added useFocusTrap Import to SplitScreenLayout
836 " 🟣 Integrated useFocusTrap Hook into SplitScreenLayout ChatPanel
837 9:45a 🔵 Agent tool execution status tracking via async queue
838 " 🔵 Streaming message API with graceful fallback for agent responses
839 " 🔵 Comprehensive agent infrastructure test coverage
840 9:46a 🟣 Added unit test suite for agent.core helper functions
841 " 🔵 Test failure in GET tool dispatch verification
842 " 🔵 Tool dispatch table configuration inspected
843 " 🔴 Fixed test tool dispatch assertions to match actual configuration
844 " 🔴 Test suite now passes completely
845 9:47a 🟣 Added unit tests for tool handler dispatch modules
846 " 🟣 Handler dispatch tests pass validation
847 " 🔵 Full test suite coverage metrics after uplift
848 " 🔵 Ollama module is conditional, feature-gated implementation
849 9:48a 🟣 Added comprehensive unit tests for OllamaClient integration
850 " 🟣 OllamaClient tests pass validation
851 " 🟣 Added unit tests for model factory selection logic
852 9:49a 🟣 Created revised factory and middleware test suite
853 " 🔵 Factory/middleware tests: 3 pass, ollama path still failing
854 " 🔵 Factory test failure: incomplete mock settings configuration
855 " 🔴 Fixed settings patch path in factory tests
856 " 🟣 Factory and middleware tests pass completely
857 " 🟣 Coverage uplift task 18.1.12 completed successfully
858 9:50a 🟣 Added unit tests for agent run_agent core function
859 " 🟣 Agent run_agent tests pass validation
860 " 🟣 Final coverage snapshot: Task 18.1.12 uplift complete
861 9:51a 🟣 Added unit tests for streaming agent execution
862 " 🔵 Streaming agent tests: 2 pass, 2 fail with asyncio gather errors
863 " 🔵 run_agent_streaming implementation calls _execute_tool_with_status with incorrect argument order
864 9:52a 🔴 Fixed streaming tests to use correct _execute_tool_with_status signature
865 " 🔵 Streaming tests still fail despite signature fix
866 " 🔵 Streaming tests: patching strategy not resolving asyncio gather failure
867 9:53a 🔵 Streaming test complexity: asyncio gather orchestration difficult to mock
868 " 🔴 Fixed asyncio.gather coroutine handling in run_agent_streaming
869 " 🟣 Streaming agent tests pass after implementation fix
870 9:54a 🟣 Final coverage uplift: Task 18.1.12 achieved 83% coverage with core agent at 93%
871 9:55a 🟣 Frontend test suite and build validation successful
874 10:00a 🟣 Created WebSocket content routing integration tests
875 " 🟣 WebSocket routing integration tests pass validation
876 10:01a 🟣 Created booking flow integration tests
877 10:02a 🔵 Booking flow integration test: schema validation error message assertion fails
878 " 🔴 Fixed Zod error assertion in booking flow schema validation test
879 " 🟣 Integration test suite complete: all tests passing
880 10:03a 🟣 Frontend test suite expanded: 60 tests across 9 files all passing

Access 126k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>