# Onboarding Guide

> How to get the full DerLg stack running locally.

---

## Prerequisites

- Node.js (LTS)
- Python 3.11+ (for AI agent)
- Docker & Docker Compose
- Git

## Quick Start

1. Clone the repo
2. Copy environment files from `.env.example` in each service directory
3. Run `docker-compose up` from the repo root (PostgreSQL, Redis, Backend, Frontend, AI Agent)
4. Prisma migrations and seed run automatically on first startup

## Environment Files

Each service requires its own `.env`:
- `backend/.env` — Database URL, JWT secrets, Stripe keys, AI service key
- `frontend/.env.local` — API URL, public config
- AI agent `.env` — Claude API key, backend service key

See `.kiro/specs/backend-nestjs-supabase/` for the full required variable list.

## Local Tooling

- **Database GUI:** Prisma Studio (`npx prisma studio` from `backend/`)
- **API Testing:** Swagger UI at `http://localhost:3001/api`
- **Frontend Dev:** `npm run dev` in `frontend/` (port 3000)
- **Backend Dev:** `npm run start:dev` in `backend/` (port 3001)

---

*For detailed implementation specs, see `.kiro/specs/`.*
