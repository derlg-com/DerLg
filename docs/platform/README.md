# Platform Documentation

> How the whole system works. Cross-cutting concerns, architecture, and team onboarding.

---

## Documents

### Architecture

| File | Purpose |
|------|---------|
| [architecture/system-overview.md](./architecture/system-overview.md) | System architecture, service boundaries, auth flow, payment flow, real-time channels |

### Roadmaps

| File | Purpose |
|------|---------|
| [roadmaps/architecture-roadmap.md](./roadmaps/architecture-roadmap.md) | Plan for completing the official architecture document |
| [roadmaps/backend-roadmap.md](./roadmaps/backend-roadmap.md) | Backend (NestJS) design phases and decision log |
| [roadmaps/frontend-roadmap.md](./roadmaps/frontend-roadmap.md) | Frontend (Next.js) design phases and decision log |

### Guides

| File | Purpose |
|------|---------|
| [guides/onboarding.md](./guides/onboarding.md) | New developer setup, environment configuration, local tooling |

---

## What Belongs Here vs. in `modules/`

- **Platform** — Docs that span multiple features or describe the system as a whole (architecture, deployment, auth patterns, data model, onboarding).
- **Modules** — Docs scoped to a single feature (F01–F16) such as requirements, architecture, and API specs for that feature only.
