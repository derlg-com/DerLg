# DerLg Backend Mission

> Why this backend exists, what success looks like, and what we explicitly do not do. Read this before the Constitution.

---

## Purpose

The DerLg backend is the central nervous system of a Cambodia travel booking platform. It connects international travelers to trips, hotels, guides, and transportation through a reliable, secure, and fast API. It powers the AI concierge, handles payments across multiple methods, and ensures bookings never conflict.

**In one sentence:** We are the truth layer between travelers, inventory, payments, and AI.

---

## Success Criteria

### Functional
- [ ] Travelers can browse, search, and book trips, hotels, guides, and transportation without errors
- [ ] Bookings hold inventory for 15 minutes and expire automatically if unpaid
- [ ] No double-bookings ever occur (overlap protection across all inventory types)
- [ ] Payments complete through Stripe (card) and QR (Bakong/ABA) with webhook confirmation
- [ ] AI concierge can search inventory, create bookings, and generate payment QR codes via tool endpoints
- [ ] Student discounts apply automatically after admin verification
- [ ] Loyalty points accrue on confirmed bookings and verified reviews
- [ ] Emergency alerts notify admins immediately with location data
- [ ] All user-facing content supports English, Chinese, and Khmer

### Non-Functional
- [ ] API response time: list endpoints < 300ms, detail endpoints < 200ms (p95)
- [ ] 99.9% uptime for booking and payment flows
- [ ] Zero data loss for payments and bookings
- [ ] GDPR-compliant data handling with soft deletes and audit logs
- [ ] Horizontal scaling ready (stateless API, Redis sessions, no local file storage)
- [ ] 80% unit test coverage, 90% on auth/booking/payment paths

---

## Principles

1. **Inventory is sacred.** A confirmed booking means the resource is reserved. Overbooking is a system failure.
2. **Payment is atomic.** Money moves only after booking confirmation. Webhooks are idempotent.
3. **AI is a client, not a god.** The AI agent calls our tools; it never writes directly to the database.
4. **Security by default.** Every endpoint assumes zero trust until authenticated and authorized.
5. **Events over imports.** Feature modules communicate through domain events, not direct imports.
6. **Observability is not optional.** Every error is logged, every mutation is audited, every payment is traceable.

---

## In Scope

- REST API for all client operations (`/v1/*`)
- AI tool endpoints (`/v1/ai-tools/*`)
- Custom JWT authentication with refresh token rotation
- Booking engine with hold mechanism and overlap protection
- Payment processing (Stripe cards + QR codes)
- Refund logic with tiered cancellation policy
- Background jobs (expiry cleanup, travel reminders, festival alerts)
- Notification plumbing (email, push, in-app)
- Admin endpoints for verification, analytics, and audit logs
- Health checks and graceful shutdown

---

## Out of Scope

- **Real-time chat server** — WebSocket for AI chat lives separately (may proxy through backend)
- **AI model training** — The LangGraph agent is a separate Python service
- **Mobile apps** — Backend serves API only; no native app code
- **CMS for content** — Content is seeded and managed via admin endpoints, not a full CMS
- **Multi-region deployment** — Single region (Southeast Asia) for MVP
- **Blockchain payments** — Bakong QR via Stripe only; no direct blockchain integration

---

## Definition of Done (Backend v1.0)

All Phase 0–13 milestones from `roadmap.md` are complete, plus:

- [ ] E2E test suite passes end-to-end for: register → book → pay → cancel → refund
- [ ] Load test: 100 concurrent bookings with zero overbooking
- [ ] Security scan: no high or critical vulnerabilities
- [ ] Documentation: Swagger UI serves complete API docs at `/api/docs`
- [ ] Deployment: single-command Docker Compose up in production
- [ ] Handoff: new developer can `git clone`, `docker-compose up`, and have a working local environment in under 10 minutes

---

## Target State

```
Traveler opens app
    → Search trips/places/hotels/guides (< 300ms)
    → Select and book (hold placed, 15-min timer starts)
    → Pay via card or QR (Stripe confirms, booking locks)
    → Receive confirmation email + push
    → Review after trip (earns loyalty points)

AI concierge handles chat
    → Calls /v1/ai-tools/search/trips
    → Calls /v1/ai-tools/bookings
    → Calls /v1/ai-tools/payments/qr
    → Never touches database directly

Admin monitors via dashboard
    → Approves student verifications
    → Views analytics
    → Reviews audit logs
    → Handles emergency alerts
```

---

## References

- Constitution (rules): `CONSTITUTION.md`
- Tech stack: `TECH-STACK.md`
- Roadmap: `plans/roadmap.md`
