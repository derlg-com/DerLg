# Document Relationships

> **Source:** `.kiro/specs/vibe-booking/requirements.md` (original backend spec)
> **Consolidated into:** `.kiro/specs/vibe-booking-final/requirements.md`
> **Note:** This cross-reference table was present in the original but dropped during consolidation.

---

## Related Documents

| Document | Path | Purpose |
|----------|------|---------|
| Product Requirements Document | `docs/product/prd.md` | High-level product requirements, user stories, and feature definitions |
| Feature Decisions Registry | `docs/product/feature-decisions.md` | Canonical feature registry with scope, priority, status, and release assignment |
| System Architecture Overview | `docs/platform/architecture/system-overview.md` | System architecture, auth flow, payment flow, and deployment topology |
| Real-time & AI Architecture | `docs/platform/architecture/realtime-and-ai.md` | WebSocket protocol, AI agent integration, and streaming architecture |
| Backend API Contract (YAML) | `docs/modules/vibe-booking/api.yaml` | OpenAPI-style API contract for the Vibe Booking module endpoints |
| AI Chat Module API | `docs/modules/ai-chat/api.yaml` | API contract for AI chat endpoints (merged into vibe-booking) |
| Technology Decisions | `.kiro/steering/tech.md` | Technology stack decisions, common commands, and dependency versions |
| Directory Structure | `.kiro/steering/structure.md` | Planned directory structure and naming conventions |
| Glossary | `docs/glossary.md` | Domain terms, abbreviations, and entity definitions |

---

## Spec Hierarchy

```
.prd.md (highest level)
  └─ feature-decisions.md (F10–F16: Vibe Booking)
        └─ vibe-booking-final/requirements.md (unified full-stack)
              ├─ vibe-booking-final/design.md (architecture & data flow)
              └─ vibe-booking-final/tasks.md (implementation checklist)
```

## Source Specs (Deprecated — Redirect Here)

| Deprecated Spec | Redirects To | Notes |
|-----------------|--------------|-------|
| `.kiro/specs/vibe-booking/` | `.kiro/specs/vibe-booking-final/` | Original backend-only spec; superseded by unified spec |
| `.kiro/specs/vibe-booking-frontend/` | `.kiro/specs/vibe-booking-final/` | Original frontend Stream Mode spec; merged into unified spec |
| `docs/modules/vibe-booking/` | `.kiro/specs/vibe-booking-final/` | Module-level API docs; content merged |
| `docs/modules/ai-chat/` | `.kiro/specs/vibe-booking-final/` | Duplicate module docs; collapsed into redirect tombstones |

---

## Implementation Status

| Area | Status | Notes |
|------|--------|-------|
| Backend (NestJS) | In progress | Auth, database schema, basic modules scaffolded |
| AI Agent (Python) | In progress | LangGraph graph, tools, WebSocket handler implemented |
| Frontend (Next.js) | Not started | Stream Mode UI pending |
| Database (Supabase) | Ready | Schema deployed, connection verified |
| Redis (Docker) | Ready | Local Docker instance running |
