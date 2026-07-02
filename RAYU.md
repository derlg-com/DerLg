# RAYU.md

This file provides guidance to RAYU when working with code in this repository.

## Services

Three independently runnable services:

| Service | Directory | Port | Tech |
|---------|-----------|------|------|
| Frontend | `frontend/` | 3000 | Next.js 16, React 19, Tailwind v4, TypeScript |
| Backend | `backend/` | 3001 | NestJS 11, Prisma, TypeScript |
| AI Agent | `vibe-booking/` | 8000 | Python 3.12, FastAPI, LangGraph, NVIDIA gpt-oss-120b |

## Common Commands

### Frontend (`cd frontend`)
```bash
npm run dev          # Dev server
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest (run once)
```

### Backend (`cd backend`)
```bash
npm run start:dev    # Hot-reload dev server
npm run build        # Compile TS → dist/
npm run test         # Jest unit tests
npm run test:e2e     # E2E tests (test/)
npm run test:cov     # Jest with coverage
npm run lint         # ESLint with auto-fix
npm run format       # Prettier
npx jest src/path/to/file.spec.ts   # Single test file
npx prisma migrate dev              # Apply DB migrations
npx prisma generate                 # Regenerate Prisma client
npx prisma studio                   # DB GUI
```

### AI Agent (`cd vibe-booking`)
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload   # Dev server

pytest                                        # All tests
pytest tests/unit/                            # Unit only
pytest --cov=agent --cov-report=html          # With coverage
```

## Infrastructure (Docker)

### Backend dev dependencies (`cd backend`)
```bash
docker compose up -d   # Starts: postgres (5433), redis (6379)
```

### MinIO (object storage for images/media — dev only)
MinIO is self-hosted in Docker. It is used by the backend for image and media uploads. Run it alongside the backend services. Access the MinIO console at `http://localhost:9001` (default dev credentials in `.env`).

### PostgreSQL
Primary database is **PostgreSQL via Supabase**. The `backend/docker-compose.yml` also spins up a local `postgres:16-alpine` on port **5433** as an alternative dev target. Connection is configured via `DATABASE_URL` and `DIRECT_URL` env vars in `backend/.env`.

### Redis
Used by both the backend (sessions, rate limiting, booking holds with 15-min TTL) and the AI agent (session state, pub/sub for payment events). Dev: `redis:8.6-alpine` on port **6379** via `backend/docker-compose.yml`.

## Architecture

```
Next.js (3000) ──REST /v1/*──► NestJS (3001) ──X-Service-Key──► Python AI (8000)
                                     │
               ┌─────────────────────┼────────────────┐
               ▼                     ▼                ▼
         Supabase PG            Redis (6379)        MinIO (9000)
```

- **Frontend ↔ Backend:** REST with `{ success, data, message, error }` envelope. Bearer JWT in `Authorization` header.
- **Frontend ↔ AI Agent:** WebSocket at `/ws/{session_id}`. Structured JSON message types (`agent_message`, `trip_cards`, `qr_payment`, etc.).
- **AI Agent → Backend:** HTTP tool calls to `/v1/ai-tools/*` authenticated with `X-Service-Key` header. The AI agent **never writes to the DB directly**.
- **Response format:** AI sends structured JSON `content_payload`; the frontend owns all rendering.

## Key Conventions

- API prefix: `/v1/` (backend), `/v1/ai-tools/*` (AI service endpoints)
- Naming: React components `PascalCase`, utilities `kebab-case`, variables/functions `camelCase`, constants `UPPER_SNAKE_CASE`, DB tables `snake_case`
- Frontend imports use `@/` alias; backend uses relative imports within a module
- Never hardcode secrets — all credentials via env vars; `.env` files are gitignored
- Backend spec files live in `backend/context/` (SCHEMA.md, API-CONTRACT.md, etc.) — read before modifying endpoints or schema
- AI agent module docs in `vibe-booking/AGENT.md`; frontend docs in `frontend/AGENTS.md`

## Authoritative Spec Files

| What | Where |
|------|-------|
| DB schema (Prisma) | `backend/context/specs/SCHEMA.md` + `backend/prisma/schema.prisma` |
| All ~80 API endpoints | `backend/context/specs/API-CONTRACT.md` |
| Error codes | `backend/context/specs/ERROR-REGISTRY.md` |
| Backend implementation roadmap | `backend/context/plans/ROADMAP.md` |
| AI agent architecture | `vibe-booking/AGENT.md` |
| Frontend specs | `.kiro/specs/frontend-nextjs-implementation/` |
| Vibe Booking AI specs | `.kiro/specs/vibe-booking/` |
